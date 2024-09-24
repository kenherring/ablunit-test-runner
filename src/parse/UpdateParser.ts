import { TestItem, TestRun, Uri } from 'vscode'
import { readLinesFromFile } from './TestParserCommon'
import { log } from '../ChannelLogger'

export enum TestStatus {
	unknown = 'unknown',
	testRoot = 'TEST_ROOT',
	testTree = 'TEST_TREE',
	stackTrace = 'STACK_TRACE',

	// test statuses
	enqueud = 'enqueued',
	skipped = 'TEST_IGNORED',
	started = 'TEST_START',
	passed = 'TEST_END',
	failed = 'TEST_FAIL',
	errored = 'TEST_ERROR',
	complete = 'COMPLETE',
}

function testStatusOrder (event: TestStatus | undefined) {
	switch (event) {
		case undefined: return -1
		case TestStatus.unknown: return 0
		case TestStatus.testTree: return 10
		case TestStatus.testRoot: return 11
		case TestStatus.enqueud: return 20
		case TestStatus.started: return 30
		case TestStatus.passed: return 40
		case TestStatus.failed: return 41
		case TestStatus.stackTrace: return 42
		case TestStatus.errored: return 43
		case TestStatus.skipped: return 44
		case TestStatus.complete: return 50
		default: return -2
	}
}

interface ITestNode {
	id: string
	parent?: ITestNode
	name: string
	suiteFlag: boolean
	status: TestStatus
	time?: number
	test?: TestItem
}

let prevRootText: string
let updates: ITestNode[]
let newUpdates: ITestNode[]

function parseTestTree (line: string, tests: TestItem[]) {
	if (line.startsWith('TEST_TREE ')) {
		line = line.substring('TEST_TREE '.length)
	}
	const nodes = line.split('*').filter((node) => node.trim() != '')
	const parents: ITestNode[] = []
	log.debug('nodes.length = ' + nodes.length)
	const testTree: ITestNode[] = []

	let idx = -1
	try {
		for (const node of nodes) {
			idx++
			if (node == '') {
				continue
			}
			log.debug('nodes[' + idx + '] = ' + node)
			if (node == '\\NULL') {
				parents.pop()
				continue
			}

			const [name, suiteFlag, id] = node.split('?')

			log.debug('create test update record id=' + id + '; name=' + name + '; parent=' + parents[parents.length - 1]?.name)

			const item: ITestNode = {
				id,
				parent: parents[parents.length - 1],
				name: name.replace(/\\/g, '/'),
				suiteFlag: Boolean(suiteFlag),
				status: TestStatus.enqueud,
			}
			item.test = getTestForItem(tests, item)
			testTree.push(item)
			parents.push(testTree[testTree.length - 1])
		}
	} catch (e) {
		log.error('Error parsing test tree: ' + e)
	}
	return testTree
}

export function updateParserInit () {
	prevRootText = ''
	updates = []
}

function parseUpdateLines (lines: string[], tests: TestItem[]) {
	newUpdates = []
	for (let lineNum = 0; lineNum < lines.length; lineNum++) {
		const line = lines[lineNum]
		const event = line.split(' ')[0] ?? 'unknown'
		const eventStatus = event as TestStatus ?? TestStatus.unknown

		if (event === 'TEST_TREE') {
			if (!lines[lineNum + 1]) {
				// nothing to do, we don't have any updates and only the tree, which might not be complete
				continue
			}
			if (lines[lineNum + 1].startsWith('TEST_TREE')) { // last TEST_TREE line
				log.debug('TEST_TREE unchanged from last parsing')
				continue
			}
			if (prevRootText !== line) {
				updates = parseTestTree(line, tests)
				prevRootText = line
				log.debug('updates.length=' + updates.length)
				continue
			}
			continue
		}
		if (event === 'COMPLETE') {
			continue
		}

		const [ , id, timeVal ] = line.split(' ')
		const time = Number(timeVal ?? 0) * 1000
		const idx = updates.findIndex((test) => test.id === id)
		if (!updates[idx]) {
			log.error('Test not found for id=' + id + '; event=' + event + ' (line=' + lineNum + ')')
			continue
		}

		if (testStatusOrder(eventStatus) <= testStatusOrder(updates[idx].status)) {
			// skip already set values
			log.debug('skipping already set value: ' + eventStatus + '; updatee[' + idx + '].status=' + updates[idx].status)
			continue
		}

		if (eventStatus == TestStatus.complete) {
			// nothing to do
			continue
		}
		if (eventStatus == TestStatus.stackTrace) {
			// TODO - import the error message and stack trace
			continue
		}

		if (eventStatus == TestStatus.started || eventStatus == TestStatus.failed || eventStatus == TestStatus.passed || eventStatus == TestStatus.skipped) {
			updates[idx].status = eventStatus
			updates[idx].time = time
			// remove any previous updates for this test
			newUpdates = newUpdates.filter((test) => test.id != id)
			// add the new update
			if (updates[idx].name != 'TEST_ROOT') {
				newUpdates.push(updates[idx])
			}
			log.debug('set updates[' + idx + '].status=' + eventStatus + '; time=' + time + '; parentName=' + updates[idx].parent?.name + '; name=' + updates[idx].name)
			continue
		}


		/* Log and move on instead of throwing ... the parsing of result.xml will overwrite this anyway */
		log.error('Unknown event type: ' + event + '(line[' + lineNum + ']: ' + line + ')')
	}
	log.debug('return updates.length=' + updates.length)
	return updates
}

function getTestForItem (tests: TestItem[], item: ITestNode) {
	// TODO - improve performance with a map
	if (!item.parent) {
		if (item.name != 'TEST_ROOT') {
			log.warn('No parent found for item.id=' + item.id + '; item.name=' + item.name)
		}
		return undefined
	}

	let testId: string
	testId = item.name
	if (item.parent.name != 'TEST_ROOT') {
		testId = item.parent.name + '#' + item.name
	}

	for (const test of tests) {
		log.debug('test.id=' + test.id)
		if (test.id.replace(/\\/g, '/').endsWith(testId)) {
			return test
		}
		if (test.id.replace(/\\/g, '/').endsWith(item.parent.name)) {
			for(const [ id, child] of test.children) {
				if (id.replace(/\\/g, '/').endsWith(testId)) {
					log.debug('child.id=' + child.id)
					return child
				}
			}
		}
	}
	log.warn('No test found for ' + testId)
	return undefined
}

function setTestRunTestStatus (options: TestRun, item: ITestNode) {
	let printName: string
	if(item.name == 'TEST_ROOT') {
		return
	}
	printName = '  ' + item.name
	if (item.parent?.name == 'TEST_ROOT') {
		printName = item.name
	}

	switch (item.status) {
		case TestStatus.started:
			if (item.test) {
				options.started(item.test)
			}
			if (!item.parent || item.parent.name == 'TEST_ROOT') // only print parent stated, not tests
				log.info('\t🔵  ' + printName, options)
			break
		case TestStatus.failed:
			if (item.test) { options.failed(item.test, [], item.time) }
			log.info('\t❌  ' + printName, options)
			break
		case TestStatus.passed:
			if (item.test) { options.passed(item.test, item.time) }
			log.info('\t✅  ' + printName + ' (' + item.time?.toFixed(0) + 'ms)', options)
			break
		case TestStatus.testRoot:
			if (item.test) { options.enqueued(item.test) }
			break
		case TestStatus.skipped:
			if (item.test) { options.skipped(item.test) }
			log.info('\t❔  ' + printName, options)
			break
		default: log.error('unexpected item.status=' + item.status + '; item.id=' + item.id + '; item.name=' + item.name)
	}
}

export function parseUpdates (filepath: Uri | string, tests: TestItem[]) {
	log.debug('Parsing updates from: ' + filepath)
	// instead of reading the whole file we could buffer it and only read the new lines
	return readLinesFromFile(filepath)
		.then((lines) => { return parseUpdateLines(lines, tests) }, (e) => { throw e })
}

function showUpdates (options: TestRun, updates: ITestNode[] | undefined) {
	if (!updates) {
		log.warn('No updates found')
		return
	}

	log.info('showing test run updates (updates.length=' + updates.length + ')')
	while (updates.length > 0) {
		const item = newUpdates.shift()
		if (!item) {
			log.debug('item is undefined (updates.length=' + updates.length + ')')
			// end of array - shift returned undefined
			break
		}
		if (item.name == 'TEST_ROOT') {
			continue
		}
		setTestRunTestStatus(options, item)
	}
	return true
}

export function processUpdates (options: TestRun, tests: TestItem[], updateFile: Uri | undefined) {
	if (!updateFile) {
		return
	}
	return parseUpdates(updateFile, tests)
		.then((updates) => {
			const r = showUpdates(options, updates)
			if (r) {
				log.debug('updates processed and displayed successfully')
				return true
			}
			log.info('unexpected response from showUpdates: ' + r)
			return true
		}, (e) => {
			log.warn('Error processing updates: ' + e)
			if (e instanceof Error) {
				log.warn(e.stack!)
			}
			// eat this error, we don't want to stop the test run because of it
			return true
		})
}
