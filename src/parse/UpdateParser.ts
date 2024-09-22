import { TestItem, TestMessage, TestRun, Uri } from 'vscode'
import { readLinesFromFile } from './TestParserCommon'
import { log } from '../ChannelLogger'
import { ABLResults } from 'ABLResults'

enum TestStatus {
	unknown = 'unknown',
	testTree = 'TEST_TREE',
	stackTrace = 'STACK_TRACE',

	// test statuses
	enqueud = 'enqueued',
	started = 'TEST_START',
	passed = 'TEST_END',
	failed = 'TEST_FAIL',
	errored = 'TEST_ERROR',
	complete = 'COMPLETE',

	startedSet = 'started-set',
	passedSet = 'passed-set',
	failedSet = 'failed-set',
	erroredSet = 'errored-set'
}

interface ITestTree {
	id: number
	parentName: string
	name: string | undefined
	suiteFlag: boolean
	status: TestStatus
	time?: number
}

// class TestEvents {
// 	public static readonly STARTED = 'TEST_START'
// 	public static readonly PASSED = 'TEST_END'
// 	public static readonly FAILED = 'TEST_FAIL'

// 	public static readonly RESULT = 'STACK_TRACE'
// 	public static readonly TEST_ROOT = 'TEST_ROOT'
// 	public static readonly COMPLETE = 'COMPLETE'
// }

function parseTestTree (line: string) {
	if (line.startsWith('TEST_TREE ')) {
		line = line.substring('TEST_TREE '.length)
	}
	const nodes = line.split('*')
	log.info('nodes.length = ' + nodes.length)
	const testTree: ITestTree[] = []

	let parentName: string | undefined = undefined
	let idx = -1
	try {
		for (const node of nodes) {
			idx++
			if (node == '\\NULL' || node == '') {
				// two nulls in a row means the next node is a parent node
				if (idx > 0 && nodes[idx - 1] == '\\NULL') {
					log.info('UNSET parentName')
					parentName = undefined
				}
				continue
			}
			if (parentName == 'TEST_ROOT') {
				// not really a parent in a way we care about
				parentName = undefined
			}

			let suiteFlag: string
			let id: string
			let name: string | undefined = undefined
			if (!parentName) {
				[ parentName, suiteFlag, id ] = node.split('?')
				name = undefined
			} else {
				[ name, suiteFlag, id ] = node.split('?')
			}
			parentName = parentName.replace(/\\/g, '/')
			if (name) {
				name = name.replace(/\\/g, '/')
			}
			if (name && name.trim() === '') {
				name = undefined
			}

			// skip suite updates for now...
			if (suiteFlag == 'false' && parentName != 'TEST_ROOT') {
				testTree.push({
					id: Number(id),
					parentName,
					name,
					suiteFlag: false,
					// suiteFlag: suiteFlag ==='true',
					status: TestStatus.unknown
				})
			}
		}
	} catch (e) {
		log.error('Error parsing test tree: ' + e)
	}
	return testTree
}


let prevRootText = ''
let updates: ITestTree[] = []

function parseUpdateLines (lines: string[]) {
	for (let lineNum = 0; lineNum < lines.length; lineNum++) {
		const line = lines[lineNum]
		const event = line.split(' ')[0] ?? 'unknown'
		let eventStatus = event as TestStatus ?? undefined
		if (!eventStatus) {
			switch (event) {
				case 'TEST_START': eventStatus = TestStatus.started; break
				case 'TEST_END': eventStatus = TestStatus.passed; break
				case 'TEST_FAIL': eventStatus = TestStatus.failed; break
				case 'COMPLETE': eventStatus = TestStatus.errored; break
				default: eventStatus = TestStatus.unknown; break
			}
		}

		if (event === 'TEST_TREE') {
			if (!lines[lineNum + 1]) {
				// nothing to do, we don't have any updates
				return
			}
			if (!lines[lineNum + 1].startsWith('TEST_TREE')) { // last TEST_TREE line
				if (prevRootText !== line) {
					updates = parseTestTree(line)
					prevRootText = line
					log.debug('updates.length=' + updates.length)
				} else {
					log.debug('TEST_TREE unchanged from last parsing')
				}
			}
			continue
		}

		const [ , id, timeVal ] = line.split(' ')
		const time = Number(timeVal)
		const idx = updates.findIndex((test) => test.id === Number(id))
		if (!updates[idx]) {
			if (id != '0') {
				log.error('Test not found for id=' + id + ' (line=' + lineNum + ')')
			}
			continue
		}
		if (updates[idx].status == TestStatus.startedSet ||
			updates[idx].status == TestStatus.passedSet ||
			updates[idx].status == TestStatus.failedSet ||
			updates[idx].status == TestStatus.erroredSet) {
			// skip already set values
			continue
		}

		if (eventStatus == TestStatus.started || eventStatus == TestStatus.failed || eventStatus == TestStatus.passed) {
			// const [ , id ] = line.split(' ')
			// const [ , id, time ] = line.split(' ')
			updates[idx].status = eventStatus
			updates[idx].time = time
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

		/* Log and move on instead of throwing ... the parsing of result.xml will overwrite this anyway */
		log.error('Unknown event type: ' + event + '(line[' + lineNum + ']: ' + line + ')')
	}
	log.debug('return updates.length=' + updates.length)
	return updates
}

export function parseUpdates (filepath: Uri | string) {
	log.debug('Parsing updates from: ' + filepath)
	const updates = readLinesFromFile(filepath)
		.then((lines) => { return parseUpdateLines(lines) })
	return updates
}

function getTestForItem (tests: TestItem[], item: ITestTree) {
	for (const test of tests) {
		if (test.id.replace(/\\/g, '/').endsWith(item.parentName)) {
			if (item.name) {
				// update TestMethod or TestProcedure
				for (const [, child] of test.children) {
					if (child.label == item.name) {
						return child
					}
				}
			} else {
				// update TestClass or TestProgram
				return test
			}
		}
	}
	log.info('No test found for item.id=' + item.id + '; item.parentName=' + item.parentName + '; item.name=' + item.name)
	return undefined
}

function setTestRunTestStatus (options: TestRun, test: TestItem, item: ITestTree) {
	switch (item.status) {
		case TestStatus.started: options.started(test); break
		case TestStatus.failed: options.failed(test, new TestMessage('Test case failed'), item.time); break
		case TestStatus.passed: options.passed(test, item.time); break
		default: log.error('unexpected item.status=' + item.status)
	}
}

function showUpdates (options: TestRun, res: ABLResults, updates: ITestTree[] | undefined) {
	if (!updates) {
		log.warn('No updates found')
		return
	}
	log.info('showing test run updates (updates.length=' + updates.length + ')')

	const counts = new Map<string, number>()
	const countError = 0
	try {
		for(const item of updates) {
			if (item.status === TestStatus.unknown) {
				counts.set(TestStatus.unknown, (counts.get('unknown') ?? 0) + 1)
				continue
			}
			if (item.status.endsWith('-set')) {
				counts.set('prev-set', (counts.get('prev-set') ?? 0) + 1)
				continue
			}

			if (item.status === TestStatus.started || item.status === TestStatus.passed || item.status === TestStatus.failed) {
				// TODO performance
				const test = getTestForItem(res.tests, item)
				if (!test) {
					log.error('No test found for item.id=' + item.id)
					continue
				}
				log.info('set test status to ' + item.status + ': ' + test.id)
				setTestRunTestStatus(options, test, item)
				updates[updates.findIndex((test) => test.id === item.id)].status = (item.status + '-set') as TestStatus
				continue
			}
			log.error('Unexpected item.status=' + item.status)
			counts.set('unexpected', (counts.get('unexpected') ?? 0) + 1)
		}
	} catch (e) {
		log.error('Error processing updates: ' + e)
	}
	log.info('test run status update summary:')
	for (const [ key, value ] of counts) {
		log.info('  ' + key + ': ' + value)
	}
}

export function processUpdates (options: TestRun, res: ABLResults, updateFile: Uri) {
	return parseUpdates(updateFile)
		.then((updates) => {
			showUpdates(options, res, updates)
			return
		}, (e) => {
			log.info('e=' + e)
			throw e})
}
