import * as vscode from 'vscode';

// CLASS statement
const headingRe = /^\s+class (\S+)\s*:/;
// METHOD statement

const testRe = /^\s+method public void (\S+) /;

export const parseABLUnit = (text: string, events: {
	onTest(range: vscode.Range, methodName: string): void;
	onHeading(range: vscode.Range, className: string): void;
}) => {

	if (text.toLowerCase().indexOf("@test.") == -1)
		return;

	const lines = text.split('\n');


	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		const line = lines[lineNo];
		const test = testRe.exec(line);

		if (test) {
			const [, methodName] = test;
			const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, test[0].length));
			
			const prevLine = lines[lineNo - 1];
			if(prevLine.toLowerCase().indexOf("@test.") != -1) {
				events.onTest(range, methodName);
				continue;
			}
		}

		const heading = headingRe.exec(line);
		if (heading) {
			const [, className] = heading;
			const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length));
			events.onHeading(range, className);
		}
	}
};
