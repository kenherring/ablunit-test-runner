import { TestMessage, TestRun, Uri } from 'vscode'
import { readLinesFromFile } from './TestParserCommon'
import { log } from '../ChannelLogger'
import { ABLResults } from 'ABLResults'

interface ITestTree {
	id: number
	parentName: string
	name: string | undefined
	suiteFlag: boolean
	status: string
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
			log.info('100 node[' + idx + ']=' + node)
			if (node == '\\NULL' || node == '') {
				log.info('101 node[' + (idx - 1) + ']=' + nodes[idx - 1])

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
			// log.info('102')
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
			// log.info('103 parentName=' + parentName + ', name=' + name + ', suiteFlag=' + suiteFlag + ', id=' + id)

			// skip suite updates for now...
			if (suiteFlag == 'false' && parentName != 'TEST_ROOT') {
				// log.info('110 testTree.push')
				testTree.push({
					id: Number(id),
					parentName,
					name,
					suiteFlag: false,
					// suiteFlag: suiteFlag ==='true',
					status: 'unknown'
				})
				// log.info('120 parentName=' + parentName)
			}
		}
	} catch (e) {
		log.error('Error parsing test tree: ' + e)
	}
	// log.info('120 testTree.length=' + testTree.length)
	return testTree
}


let prevRootText = ''
let updates: ITestTree[] = []

function parseUpdateLines (lines: string[]) {

	let lineNum = -1
	for (const line of lines) {
		lineNum++
		if (line.trim() === '') {
			continue
		}
		const event = line.split(' ')[0]
		if (event === 'TEST_TREE') {
			if (!lines[lineNum + 1]) {
				// nothing to do, we don't have any updates
				return
			}
			if (!lines[lineNum + 1].startsWith('TEST_TREE')) { // last TEST_TREE line
				if (prevRootText !== line) {
					updates = parseTestTree(line)
					prevRootText = line
					log.info('updates.length=' + updates.length)
				} else {
					log.info('TEST_TREE unchanged from last parsing')
				}
			}
		} else if (event === 'TEST_START') {
			const [ , id ] = line.split(' ')
			const idx = updates.findIndex((test) => test.id === Number(id))
			if (!updates[idx]) {
				if (id != '0') {
					log.error('Test not found for id=' + id + ' (line=' + lineNum + ')')
				}
				continue
			}
			if (updates[idx].status != 'started-set') {
				updates[idx].status = 'started'
			}
		} else if (event === 'TEST_END') {
			const [ , id, time ] = line.split(' ')
			const idx = updates.findIndex((test) => test.id === Number(id))
			if (!updates[idx]) {
				if (id != '0') {
					log.error('Test not found for id=' + id + '(line=' + lineNum + ')')
				}
				continue
			}
			log.info('TEST_END: item=' + JSON.stringify(updates[idx]))
			if (updates[idx].status != 'passed-set') {
				updates[idx].status = 'passed'
				updates[idx].time = Number(time)
			}
		} else if (event === 'TEST_FAIL') {
			const [ , id, time ] = line.split(' ')
			const idx = updates.findIndex((test) => test.id === Number(id))
			if (!updates[idx]) {
				if (id != '0') {
					log.error('Test not found for id=' + id + '(line=' + lineNum + ')')
				}
				continue
			}
			if (updates[idx].status != 'failed-set') {
				updates[idx].status = 'failed'
				updates[idx].time = Number(time)
			}
		} else if (event === 'COMPLETE') {
			// nothing to do
		} else if (event === 'STACK_TRACE') {
			// nothing to do, for now.  we could import this
		} else {
			log.error('Unknown event type: ' + event + '(line[' + lineNum + ']: ' + line + ')')
			// throw new Error('Unknown event type: ' + event + '(line=' + lineNum + ')')
		}
	}
	log.info('return updates.length=' + updates.length)
	return updates
}

export function parseUpdates (filepath: Uri | string) {
	log.info('Parsing updates from: ' + filepath)
	const updates = readLinesFromFile(filepath)
		.then((lines) => { return parseUpdateLines(lines) })
	return updates
}

function showUpdates (options: TestRun, res: ABLResults, updates: ITestTree[] | undefined) {
	if (!updates) {
		log.warn('No updates found')
		return
	}
	log.info('showing updates (updates.length=' + updates.length + ')')

	let countUnknown = 0
	let countStarted = 0
	let countPassed = 0
	let countFailed = 0
	let countOther = 0
	let prevSet = 0
	const countError = 0
	try {
		updates.forEach((item) => {
			if (item.status === 'unknown') {
				countUnknown++
			} else if (item.status.endsWith('-set')) {
				prevSet++
			} else if (item.status === 'passed' || item.status === 'started' || item.status === 'failed') {
				// TODO - skip is previously passed
				// log.info('item=' + JSON.stringify(item))
				let passedFlag = false

				for (const test of res.tests) {
					// log.info('ti.label=' + ti.label + '; ti.id=' + ti.id + '; item.parentName=' + item.parentName + '; item.name=' + item.name)
					if (test.id.replace(/\\/g, '/').endsWith(item.parentName)) {
						// log.info('  matching parent: ' + test.id)
						if (item.name) {
							// update TestMethod or TestProcedure
							for (const [, child] of test.children) {
								if (child.label === item.name) {
									// log.info('    matching child: ' + child.id)
									// log.info('ti.label=' + child.label + '; ti.id=' + child.id + '; item.parentName=' + item.parentName + '; item.name=' + item.name)
									log.info('set child test status to ' + item.status + ': ' + child.id)
									if (item.status === 'started') {
										options.started(child)
										countStarted++
										updates[updates.findIndex((test) => test.id === item.id)].status = 'started-set'
									} else if (item.status === 'failed') {
										options.failed(child, new TestMessage('Test case failed'), item.time)
										countFailed++
										updates[updates.findIndex((test) => test.id === item.id)].status = 'failed-set'
									} else {
										options.passed(child, item.time)
										countPassed++
										updates[updates.findIndex((test) => test.id === item.id)].status = 'passed-set'
									}
									passedFlag = true
									break
								}
							}
						} else {
							// update TestClass or TestProgram
							log.info('set parent test status to ' + item.status + ': ' + test.id)
							if (item.status === 'started') {
								options.started(test)
								for (const [, child] of test.children) {
									options.started(child)
								}
								countStarted++
								updates[updates.findIndex((test) => test.id === item.id)].status = 'started-set'
							} else if (item.status === 'failed') {
								options.failed(test, new TestMessage('Test file failed!'), item.time)
								countFailed++
								updates[updates.findIndex((test) => test.id === item.id)].status = 'failed-set'
							} else {
								options.passed(test, item.time)
								countPassed++
								updates[updates.findIndex((test) => test.id === item.id)].status = 'passed-set'
							}
							passedFlag = true
							break
						}
						break
					} else {
						// log.info('not a match for parent: ' + test.id + ' vs ' + item.parentName)
					}
				}

				if (!passedFlag) {
					log.warn('No matching test item found for passed test: ' + item.parentName + '#' + item.name)
				}
			} else {
				countOther++
			}

		})
	} catch (e) {
		log.error('Error processing updates: ' + e)
	}
	log.info('updates: countUnknown=' + countUnknown + ', countStarted=' + countStarted + '; countFailed=' + countFailed + '; countPassed=' + countPassed + ', countOther=' + countOther + ', countError=' + countError + '; prevSet=' + prevSet)
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
