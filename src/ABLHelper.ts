import { Location, Position, Uri } from "vscode";
import * as fs from 'fs';

// First, attempt to match with a function/procedure/method name
// RunTests OpenEdge.ABLUnit.Runner.ABLRunner at line 149  (OpenEdge/ABLUnit/Runner/ABLRunner.r)
const stackLineRE1 = /^(\S+) (\S+) at line (\d+) +\((\S+)\)/
// Second, attempt to match with only a program name
// ABLUnitCore.p at line 79  (ABLUnitCore.r)
const stackLineRE2 = /^(\S+) at line (\d+) +\((\S+)\)$/

interface CallStackLine {
	method: string | null;
	debugFile: string;
	debugUri: Uri | null;
	debugLine: Position;
	rcode: string;
	raw: string;
}

interface CallStack {
	lines: CallStackLine[];
	firstLocation: Location;
}

export const parseABLCallStack = (text: string) => {

	const lines = text.replace(/\r/g,'').split('\n');
	const stack = {} as CallStack;

	stack.lines = [];
	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		const line = lines[lineNo];
		let test = stackLineRE1.exec(line);

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
				throw(new Error("Could not parse call stack line: '" + line + "'"));
			}
		}

		const debugUri = Uri.file(stack.lines[lineNo].debugFile);
		stack.lines[lineNo].debugUri = Uri.file(stack.lines[lineNo].debugFile);

		if (stack.firstLocation == undefined) {
			const firstUri = Uri.file(stack.lines[lineNo].debugFile);

			const path = stack.lines[lineNo].debugFile
			if (fs.existsSync(path)) {
				stack.firstLocation = new Location(firstUri, stack.lines[lineNo].debugLine);
			}

		}
	}

	return stack;
};
