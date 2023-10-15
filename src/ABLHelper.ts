import { Location, Position, Range, Uri, workspace, MarkdownString } from "vscode";
import { TCFailure } from "./parse/ablResultsParser";
import { getPromsg } from "./ABLpromsgs";
import { importDebugFile, getSourceLine } from "./ABLDebugLines";

// First, attempt to match with a function/procedure/method name
// RunTests OpenEdge.ABLUnit.Runner.ABLRunner at line 149  (OpenEdge/ABLUnit/Runner/ABLRunner.r)
const stackLineRE1 = /^(\S+) (\S+) at line ([0-9]+) +\((\S+)\)/
// Second, attempt to match with only a program name
// ABLUnitCore.p at line 79  (ABLUnitCore.r)
const stackLineRE2 = /^(\S+) at line ([0-9]+) +\((\S+)\)$/

interface CallStackLine {
	method: string | null;
	debugFile: string;
	debugUri: Uri | null;
	debugLine: Position;
	rcode: string;
	raw: string;
};

interface CallStack {
	lines: CallStackLine[];
	firstLocation: Location;
}

function getWorkspacePath(): Uri {
	if (workspace.workspaceFolders == undefined) {
		throw "No workspace folders defined"
	}
	return workspace.workspaceFolders[0].uri
}

function getDebugUri (debugFile: string): Uri {
	const debugUri = Uri.joinPath(getWorkspacePath(),debugFile)
	return debugUri
}

export async function getFailureMarkdownMessage(failure: TCFailure): Promise<MarkdownString> {
	const stack = parseABLCallStack(failure.callstack)

	// start getting the debug files where needed
	const promArr: Promise<void>[] = [Promise.resolve()]
	const paths: string[] = []
	stack.lines.forEach((line) => {
		var dbgFile = line.debugFile

		if(dbgFile.startsWith("OpenEdge.") || dbgFile === "ABLUnitCore.p") {
			return
		}

		if (!dbgFile.endsWith(".p")) {
			dbgFile = dbgFile.replace(/\./g,'/') + ".cls"
		}
		const dbgUri = getDebugUri(line.debugFile)
		if (paths.indexOf(dbgUri.fsPath) == -1) {
			paths.push(dbgUri.fsPath)
			promArr.push(importDebugFile(dbgUri))
		}
	})

	const promsgMatch = failure.message.match(/\((\d+)\)$/)
	var promsgNum = ""
	if (promsgMatch)
		promsgNum = promsgMatch[1]
	const promsg = getPromsg(Number(promsgNum))

	let stackString = failure.message
	if(promsg) {
		let count = 0
		promsg.msgtext.forEach((text: string) => {
			if (count === 0) {
				count++
			} else {
				stackString += "\n\n" + text.replace(/\\n/g,"\n\n")
			}
		})
	}

	stackString += "\n\n" + "**ABL Call Stack**\n\n"
	let stackCount = 0

	return Promise.all(promArr).then((values) => {
		// all the debug lists have been resolved, now build the stack message

		stack.lines.forEach((line) => {
			stackString += "<code>"
			if (stackCount == 0)
				stackString += "--> "
			else
				stackString += "&nbsp;&nbsp;&nbsp; "
			stackCount = stackCount + 1
			if (line.method) {
				stackString += line.method + " "
			}

			stackString += line.debugFile + " at line " + line.debugLine.line
			const dbgUri = getDebugUri(line.debugFile)
			const relativePath =  workspace.asRelativePath(dbgUri)
			if (!relativePath.startsWith("OpenEdge.") && relativePath != "ABLUnitCore.p") {
				const dbg = getSourceLine(dbgUri,line.debugLine.line)
				if(dbg) {
					const incRelativePath = workspace.asRelativePath(dbg.incUri)
					stackString += " (" + "[" + incRelativePath + ":" + dbg.incLine + "]" +
										 "(command:_ablunit.openStackTrace?" + encodeURIComponent(JSON.stringify(dbg.incUri + "&" + dbg.incLine)) + ")" + ")"
				}
			}

			stackString += "</code><br>\n"
		})
		let md = new MarkdownString(stackString);
		md.isTrusted = true;
		md.supportHtml = true;
		return md;
	})

	//TODO: failure.message should pull in promsg info from $DLC/prohelp/msgdata
	// console.log("getFail1")
	// if (promsgNum != "") {
	// 	console.log("getFail2")
	// 	const promsg = getPromsg(Number(promsgNum))
	// 	if (promsg) {
	// 		console.log("getFail3")
	// 		if (promsg.extraText) {
	// 			console.log("getFail4")
	// 			promsg.extraText.forEach((text) => {
	// 				console.log("getFail5")
	// 				stackString += "\n\n" + text
	// 			})
	// 		}
	// 	}
	// }
}

export const parseABLCallStack = (text: string) => {

	const lines = text.replace(/\r/g,'').split('\n');
	// var stack: CallStack;
	var stack = {} as CallStack;

	stack.lines = [];
	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		const line = lines[lineNo];
		var test = stackLineRE1.exec(line);

		if (test) {
			const [ , method, debugFile, debugLine, rcode] = test;
			stack.lines[lineNo] = {
				raw: line,
				method: method,
				debugFile: debugFile,
				debugUri: null,
				debugLine: new Position(Number(debugLine) - 1,0),
				rcode: rcode
			};
		} else {
			test = stackLineRE2.exec(line);
			if (test) {
				const [ , debugFile, lineNum, rcode] = test;
				stack.lines[lineNo] = {
					raw: line,
					method: null,
					debugFile: debugFile,
					debugUri: null,
					debugLine: new Position(Number(lineNum) - 1,0),
					rcode
				};
			} else {
				throw("Could not parse call stack line: '" + line + "'");
			}
		}

		const debugUri = Uri.file(stack.lines[lineNo]['debugFile']);
		stack.lines[lineNo]['debugUri'] = Uri.file(stack.lines[lineNo]['debugFile']);

		if (stack.firstLocation == undefined) {
			let firstUri = Uri.file(stack.lines[lineNo]['debugFile']);

			const fs = require('fs');
			let path = stack.lines[lineNo]['debugFile'];
			if (fs.existsSync(path)) {
				stack.firstLocation = new Location(firstUri, stack.lines[lineNo]['debugLine']);
			}

		}
	}

	return stack;
};
