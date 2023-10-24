import { workspace, Location, Position, Range } from "vscode"
import { ABLDebugLines, IDebugLine } from "../ABLDebugLines"

interface ICallStackItem {
	rawText: string
	module?: string
	debugLine?: number
	debugFile?: string
	sourceLine?: number
	// fileinfo?: IABLFile
	lineinfo?: IDebugLine
	markdownText?: string
	loc?: Location
}

export interface ICallStack {
	items: ICallStackItem[]
	markdownText?: string
}

export async function parseCallstack (debugLines: ABLDebugLines, callstackRaw: string) {

	const regex = /^(.*) at line (\d+) *\((.*)\)$/
	const lines = callstackRaw.replace(/\r/g,'').replace(/\\/g,'/').split("\n")

	const callstack: ICallStack = { items: [] }

	for (const line of lines) {
		const arr = regex.exec(line)
		if(arr?.length != 4) {
			throw new Error("cannot parse callstack line: " + line)
		}
		const module = arr[1]
		const debugLine = Number(arr[2])
		const debugFile = arr[3]

		let moduleParent = module
		if (moduleParent.indexOf(" ") != -1) {
			moduleParent = moduleParent.split(" ")[1]
		}

		const callstackItem: ICallStackItem = {
			rawText: line,
			module: module,
			debugLine: debugLine,
			debugFile: debugFile
		}

		const lineinfo = await debugLines.getSourceLine(moduleParent, debugLine)
		if(lineinfo) {
			const markdownText = module + " at line " + debugLine + " " +
				"([" + workspace.asRelativePath(lineinfo.incUri) + ":" + (lineinfo.incLine) + "]" +
				"(command:_ablunit.openCallStackItem?" + encodeURIComponent(JSON.stringify(lineinfo.incUri + "&" + (lineinfo.incLine - 1))) + "))"

			callstackItem.lineinfo = lineinfo
			callstackItem.markdownText = markdownText

			callstackItem.loc = new Location(lineinfo.incUri, new Range(
				new Position(lineinfo.incLine - 1, 0),
				new Position(lineinfo.incLine, 0)
			))
		} else {
			callstackItem.markdownText = module + " at line " + debugLine + " (" + debugFile + ")"
		}
		callstack.items.push(callstackItem)
	}
	callstack.markdownText = buildFullMarkdownText(callstack)
	return callstack
}

function buildFullMarkdownText(callstack: ICallStack) {
	let markdown: string = "**ABL Stack Trace**\n\n"
	let firstItem = true
	for (const item of callstack.items) {
		markdown += "<code>"
		if (firstItem) {
			firstItem = false
			markdown += " --> "
		} else {
			markdown += "     "
		}
		markdown += item.markdownText
		markdown += "</code></br>\n"
	}
	return markdown
}
