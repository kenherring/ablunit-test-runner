import { workspace, Location, Position, Range } from 'vscode'
import { ABLDebugLines } from '../ABLDebugLines'
import { ISourceMapItem } from './RCodeParser'
import { log } from '../ChannelLogger'

interface ICallStackItem {
	rawText: string
	module?: string
	debugLine?: number
	debugFile?: string
	sourceLine?: number
	// fileinfo?: IABLFile
	lineinfo?: ISourceMapItem
	markdownText?: string
	loc?: Location
}

export interface ICallStack {
	items: ICallStackItem[]
	markdownText?: string
}

export async function parseCallstack (debugLines: ABLDebugLines, callstackRaw: string) {

	const regex = /^(.*) at line (\d+) *\((.*)\)$/
	const lines = callstackRaw.replace(/\r/g, '').replace(/\\/g, '/').split('\n')

	const callstack: ICallStack = { items: [] }

	for (const line of lines) {
		const arr = regex.exec(line)
		if(arr?.length != 4) {
			throw new Error('cannot parse callstack line: ' + line)
		}
		const module = arr[1]
		const debugLine = Number(arr[2])
		const debugFile = arr[3]

		let moduleParent = module
		if (moduleParent.includes(' ')) {
			moduleParent = moduleParent.split(' ')[1]
		}

		const callstackItem: ICallStackItem = {
			rawText: line,
			module: module,
			debugLine: debugLine,
			debugFile: debugFile
		}

		let lineinfo: ISourceMapItem | undefined = undefined
		try {
			lineinfo = await debugLines.getSourceLine(moduleParent, debugLine)
		} catch {
			log.info('could not find source line for ' + moduleParent + ' at line ' + debugLine + '.  using raw callstack data')
		}

		if(lineinfo) {
			const markdownText = module + ' at line ' + debugLine + ' ' +
				'([' + workspace.asRelativePath(lineinfo.sourceUri, false) + ':' + (lineinfo.sourceLine) + ']' +
				'(command:_ablunit.openCallStackItem?' + encodeURIComponent(JSON.stringify(lineinfo.sourceUri + '&' + (lineinfo.sourceLine - 1))) + '))'

			callstackItem.lineinfo = lineinfo
			callstackItem.markdownText = markdownText

			callstackItem.loc = new Location(lineinfo.sourceUri, new Range(
				new Position(lineinfo.sourceLine - 1, 0),
				new Position(lineinfo.sourceLine, 0)
			))
		} else {
			callstackItem.markdownText = module + ' at line ' + debugLine + ' (' + debugFile + ')'
		}
		callstack.items.push(callstackItem)
	}
	callstack.markdownText = buildFullMarkdownText(callstack)
	return callstack
}

function buildFullMarkdownText (callstack: ICallStack) {
	let markdown: string = '## ABL Stack Trace\n\n'
	let firstItem = true
	markdown += '<style>code { white-space: pre }</style>\n\n'
	for (const item of callstack.items) {
		if (firstItem) {
			firstItem = false
			markdown += '--> '
		} else {
			markdown += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'
		}
		markdown += '<code>' + item.markdownText + '</code></br>\n'
	}
	return markdown
}
