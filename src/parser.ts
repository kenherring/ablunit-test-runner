import * as vscode from 'vscode';

// CLASS statement
const headingRe = /^\s+class (\S+)\s*:/;
// METHOD statement
const methodRe = /^\s+method\s+public\s+void\s*(\S+)\s/;
// PROCEDURE statement
const procRe = /procedure\s*(\S+)\s*:/;

export const parseABLUnit = (text: string, events: {
	onTest(range: vscode.Range, methodName: string): void;
	onHeading(range: vscode.Range, className: string): void;
}) => {
	if(text.toLowerCase().indexOf("@test.") == -1) {
		return
	}

	const lines = text.split('\n');
	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		var test = methodRe.exec(lines[lineNo]);
		if (! test) {
			test = procRe.exec(lines[lineNo]);
		}
		if (test) {
			const [, methodName] = test;
			const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, test[0].length));
			
			const prevLine = lines[lineNo - 1];
			if(prevLine.toLowerCase().indexOf("@test.") != -1) {
				events.onTest(range, methodName);
				continue;
			}
		}

		const heading = headingRe.exec(lines[lineNo]);
		if (heading) {
			const [, className] = heading;
			const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, heading.length));
			events.onHeading(range, className);
		}
	}
};
