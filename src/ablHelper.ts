//First, attempt to match with a function/procedure/method name
import { Location, Position, Range, Uri, workspace, MarkdownString } from "vscode";
import { TCFailure } from "./parse/ablResultsParser";
import { getPromsg } from "./ABLpromsgs";

// RunTests OpenEdge.ABLUnit.Runner.ABLRunner at line 149  (OpenEdge/ABLUnit/Runner/ABLRunner.r)
const stackLineRE1 = /^(\S+) (\S+) at line ([0-9]+) +\((\S+)\)/
//Second, attempt to match with only a program name
// ABLUnitCore.p at line 79  (ABLUnitCore.r)
const stackLineRE2 = /^(\S+) at line ([0-9]+) +\((\S+)\)$/

interface CallStackLine {
	method: string | null;
	debugFile: string;
	debugUri: Uri | null;
	debugLine: Position;
	rcode: string;
	raw: string;
	////TODO - find actual source line!
	// sourceFile: string | null
	// sourceUri: Uri | null
	// sourceLine: Position | null
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

export const getFailureMarkdownMessage = (failure: TCFailure): MarkdownString => {
	const stack = parseABLCallStack(failure.callstack)

	//TODO: failure.message should pull in promsg info from $DLC/prohelp/msgdata

	const promsgMatch = failure.message.match(/(\d+)/)
	var promsgNum = ""
	if (promsgMatch)
		promsgNum = promsgMatch[0]

	let stackString = failure.message
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
	
	stackString += "\n\n" + "**ABL Call Stack**\n\n"
	let stackCount = 0
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
		stackString += "[" + line.debugFile + " at line " + line.debugLine.line + "](command:_ablunit.openStackTrace?" + 
				encodeURIComponent(JSON.stringify(getDebugUri(line.debugFile) + "&" + 
				line.debugLine.line)) + ")"
		stackString += "</code><br>\n"
	})
	let md = new MarkdownString(stackString);
	md.isTrusted = true;
	md.supportHtml = true;
	return md;
}

// interface CallStackLine {
// 	method: string;
// 	debugFile: string;
// 	debugLine: number;
// 	sourceFile: string;
// 	sourceLine: number;
// 	rcodeFile: string;
// }

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
