//First, attempt to match with a function/procedure/method name
import { Location, Position, Range, Uri, workspace } from "vscode";

// RunTests OpenEdge.ABLUnit.Runner.ABLRunner at line 149  (OpenEdge/ABLUnit/Runner/ABLRunner.r)
const stackLineRE1 = /^(\S+) (\S+) at line ([0-9]+) +\((\S+)\)/
//Second, attempt to match with only a program name
// ABLUnitCore.p at line 79  (ABLUnitCore.r)
const stackLineRE2 = /^(\S+) at line ([0-9]+) +\((\S+)\)$/

interface CallStack {
	[index: number]: {
		method: string | null;
		debugFile: string;
		debugUri: Uri | null;
		debugLine: Position;
		rcode: string;
		////TODO - find actual source line!
		// sourceFile: string | null
		// sourceUri: Uri | null
		// sourceLine: Position | null
	};
	firstLocation: Location;
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

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		const line = lines[lineNo];
		console.log(lineNo + " " + line);
		var test = stackLineRE1.exec(line);

		if (test) {
			const [ , method, debugFile, debugLine, rcode] = test;
			stack[lineNo] = {
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
				stack[lineNo] = {
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

		const debugUri = Uri.file(stack[lineNo]['debugFile']);
		stack[lineNo]['debugUri'] = Uri.file(stack[lineNo]['debugFile']);

		if (stack.firstLocation == undefined) {
			// console.log("stack.firstLocation=" + stack.firstLocation);
			// console.log("source='" + stack[lineNo]['debugFile'] + "'; " + stack[lineNo]['debugLine'].toString());
			console.log("uri='" + stack[lineNo]['debugUri'])

			let firstUri = Uri.file(stack[lineNo]['debugFile']);
			console.log("firstUri=" + firstUri);

			const fs = require('fs');
			let path = stack[lineNo]['debugFile'];
			console.log("exists? " + fs.existsSync(path)); 
			if (fs.existsSync(path)) {
				console.log("debugLine: " + stack[lineNo]['debugLine'].line);
				stack.firstLocation = new Location(firstUri, stack[lineNo]['debugLine']);
			}
	
		}
	}

	return stack;
};
