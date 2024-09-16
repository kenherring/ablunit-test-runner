import { Uri } from 'vscode'
import { readLinesFromFile } from './TestParserCommon'
import { log } from '../ChannelLogger'

interface ITestTree {
	id: number
	name: string
	status: string
	time?: number
}

function parseTestTree (line: string) {
	if (line.startsWith('TEST_TREE ')) {
		line = line.substring('TEST_TREE '.length)
	}
	const nodes = line.split('*')
	log.info('nodes.length = ' + nodes.length)
	const testTree: ITestTree[] = []

	for (const node of nodes) {
		if (node === '\\NULL' || node === '') {
			continue
		}
		const [ name, b, id ] = node.split('?')
		testTree.push({
			id: Number(id),
			name,
			status: 'unknown'
		})
	}
	return testTree
}

function parseUpdateLines (lines: string[]) {
	let updates: ITestTree[] = []

	let lineNum = 0
	for (const line of lines) {
		if (line.trim() === '') {
			continue
		}
		lineNum++
		const event = line.split(' ')[0]
		if (event === 'TEST_TREE') {
			updates = parseTestTree(line)
			log.info('updates.length=' + updates.length)
		} else if (event === 'TEST_START') {
			const [ , id ] = line.split(' ')
			const item = updates.find((test) => test.id === Number(id))
			if (!item) {
				throw new Error('Test not found for id=' + id + '(line=' + lineNum + ')')
			}
			item.status = 'started'
		} else if (event === 'TEST_END') {
			const [ , id, time ] = line.split(' ')
			const item = updates.find((test) => test.id === Number(id))
			if (!item) {
				throw new Error('Test not found for id=' + id + '(line=' + lineNum + ')')
			}
			item.status = 'passed'
			item.time = Number(time)
		} else if (event === 'COMPLETE') {
			// nothing to do
		} else {
			throw new Error('Unknown event type: ' + event + '(line=' + lineNum + ')')
		}
	}
	return updates
}

export function parseUpdates (filepath: Uri | string) {
	log.info('Parsing updates from: ' + filepath)
	const updates = readLinesFromFile(filepath)
		.then((lines) => {
			log.info('read ' + lines.length + ' lines')
			return parseUpdateLines(lines)
		})
	return updates
}

function showUpdates (updates: ITestTree[]) {
	updates.forEach((item) => {
		log.info('item=' + JSON.stringify(item))
	})
}

export function processUpdates (updateFile: Uri) {
	return parseUpdates(updateFile)
		.then((updates) => {
			showUpdates(updates)
			return
		}, (e) => { throw e})
}
