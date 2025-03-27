import { workspace, Location, Position, Range, Uri } from 'vscode'
import { ABLDebugLines } from 'ABLDebugLines'
import { SourceMapItem } from 'parse/SourceMapParser'
import { log } from 'ChannelLogger'
import * as FileUtils from 'FileUtils'

interface ICallStackItem {
	rawText: string
	module?: string
	moduleParent?: string
	debugLine?: number
	debugFile?: string
	debugUri?: Uri
	sourceLine?: number
	// fileinfo?: IABLFile
	lineinfo?: SourceMapItem
	markdownText?: string
	loc?: Location
	position: Position
	range: Range
}

export interface ICallStack {
	items: ICallStackItem[]
	markdownText?: string
}

export async function parseCallstack (debugLines: ABLDebugLines, callstackRaw: string) {

	const regex = /^(.*) at line (-?\d+) *\((.*)\)$/
	if (!callstackRaw) {
		throw new Error('callstackRaw is undefined')
	}

	const lines = callstackRaw.replace(/\r/g, '').replace(/\\/g, '/').split('\n')

	const callstack: ICallStack = { items: [] }

	for (const line of lines) {
		const arr = regex.exec(line)
		if(arr?.length != 4) {
			throw new Error('cannot parse callstack line: "' + line + '"')
		}
		const module = arr[1]
		let debugLine = Number(arr[2])
		const debugFile = arr[3]

		let moduleParent = module
		if (moduleParent.includes(' ')) {
			moduleParent = moduleParent.split(' ')[1]
		}

		let debugUri: Uri | undefined = Uri.file(debugFile)
		if (!FileUtils.doesFileExist(debugUri)) {
			const fileinfo = debugLines.propath.search(debugFile)
			if (fileinfo) {
				debugUri = fileinfo.uri
			} else {
				debugUri = undefined
			}
		}

		if (debugLine <= 0) {
			debugLine = 1
		}

		const callstackItem: ICallStackItem = {
			rawText: line,
			module: module,
			moduleParent: moduleParent,
			debugLine: debugLine,
			debugFile: debugFile,
			debugUri: debugUri,
			position: new Position(debugLine - 1, 0),
			range: new Range(debugLine - 1, 0, debugLine, 0)
		}

		let lineinfo: SourceMapItem | undefined = undefined
		lineinfo = await debugLines.getSourceLine(moduleParent, debugLine)
			.catch((e: unknown) => {
				log.warn('could not find source line for ' + moduleParent + ':' + debugLine + ' using raw callstack data (e=' + e + ')')
				return undefined
			})

		if(lineinfo) {
			if (lineinfo.sourceLine <= 0) {
				lineinfo.sourceLine = 1
			}
			const markdownText = module + ' at line ' + debugLine + ' ' +
				'([' + workspace.asRelativePath(lineinfo.sourceUri, false) + ':' + lineinfo.sourceLine + ']' +
				'(command:_ablunit.openCallStackItem?' + encodeURIComponent(JSON.stringify(lineinfo.sourceUri + '&' + (lineinfo.sourceLine - 1))) + '))'

			callstackItem.lineinfo = lineinfo
			callstackItem.markdownText = markdownText

			const posStart = new Position(lineinfo.sourceLine - 1, 0)
			const posEnd = new Position(lineinfo.sourceLine, 0)
			callstackItem.loc = new Location(lineinfo.sourceUri, new Range(posStart, posEnd))
		} else {
			callstackItem.markdownText = module + ' at line ' + debugLine + ' (' + debugFile + ')'
			if (debugUri) {
				const posStart = new Position(debugLine - 1, 0)
				const posEnd = new Position(debugLine, 0)
				callstackItem.loc = new Location(debugUri, new Range(posStart, posEnd))
			}
		}
		callstack.items.push(callstackItem)
	}
	callstack.markdownText = buildFullMarkdownText(callstack)
	return callstack
}

function buildFullMarkdownText (callstack: ICallStack) {
	let markdown = '## ABL Stack Trace\n\n'
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
