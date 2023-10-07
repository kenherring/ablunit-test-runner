import * as vscode from 'vscode';

// TODO - If the XREF is available let's try to parse that instead

// TESTSUITE statement
// TODO - parse the test suites
const suiteRE = /^@testsuite\((.*)\)/i
// const suiteClassRE = /^classes\s*=\s*"([^"]+)"/
const suiteItemRE = /(classes|procedures)\s*=\s*"([^"]*)"/i
// CLASS statement
const classRE = /^\s*class\s+(\S+)\s*:/i
// METHOD statement
const methodRE = /\s+method\s(\s*public){0,1}\s*void\s*(\S[^\s\(]+)/i
// PROCEDURE statement
const procedureRE = /(^|\s+)procedure\s+(\S+)\s*:/i
// ASSERT method call
const assertRE = /(OpenEdge.Core.Assert\:\S+\s*\(.*\))/i

interface SuiteLoc {
	name: string
	type: string
	range: vscode.Range
}

export const parseABLUnit = (text: string, events: {
	// onTestSuite(range: vscode.Range, suiteName: string): void;
	onTestClass(range: vscode.Range, className: string): void;
	onTestProgram(range: vscode.Range, procedureName: string): void;
	onTestMethod(range: vscode.Range, className: string, methodName: string): void;
	onTestProcedure(range: vscode.Range, programName: string, prcocedureName: string): void;
	onAssert(range: vscode.Range, methodName: string): void;
}) => {
	
	// if(text.toLowerCase().indexOf("@test.") == -1 && text.toLowerCase().indexOf("@testsuite") == -1) {
	// console.log(text.toLowerCase().indexOf("@test."))
	if(text.toLowerCase().indexOf("@test.") == -1) {
		// console.log("return")
		return
	}

	const lines = text.replace('\r','').split('\n');
	var isTestSuite, isTestSuiteLine: boolean = false
	var assertCount = 0
	var className = "UNKNOWN"
	var programName = "UNKNOWN"
	var suiteText: string = ""
	var suiteTextLineNo: number = 0
	var suiteList: SuiteLoc[] = []
	// var procList: [{procName: string, range: vscode.Range}] = []

	// console.log("parser1")
	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		// console.log("parser2 [" + lineNo + "]: " + lines[lineNo])

		// isTestSuiteLine = false
		// if(lines[lineNo].toLowerCase().indexOf("@testsuite") > -1){
		// 	isTestSuite = true
		// 	isTestSuiteLine = true
		// 	suiteText = ""
		// }

		// var suiteResult = suiteRE.exec(lines[lineNo])
		// if (!suiteResult && isTestSuiteLine) {
		// 	console.log("searching additional lines")
		// 	suiteTextLineNo = lineNo
		// 	suiteText = lines[suiteTextLineNo].replace("\r","")
		// 	console.log(suiteText)

		// 	while(!suiteResult && suiteTextLineNo < lines.length - 1) {
		// 		suiteTextLineNo++
		// 		suiteText = suiteText + " " + lines[suiteTextLineNo].replace("\r","")
		// 		console.log(suiteText)
		// 		suiteResult = suiteRE.exec(suiteText)
		// 		if (suiteResult) {
		// 			console.log("success!!")
		// 		}
		// 		console.log(suiteResult)

		// 	}
		// 	if(suiteTextLineNo >= lines.length) {
		// 		console.log("THROW")
		// 		continue
		// 	}
		// 	console.log("FOUND!!!")
		// }
		// if (suiteResult) {
		// 	const [, params] = suiteResult
		// 	console.log("params=" + params)
		// 	const cr = suiteItemRE.exec(lines[lineNo])
		// 	if(cr) {
		// 		const [, type, list, list2] = cr
		// 		const split = list.split(',')
		// 		if (list2) {
		// 			console.log("found list2!!!")
		// 		}
		// 		for (let idx=0; idx<split.length; idx++) {
		// 			console.log("ADD: " + split[idx])
		// 			suiteList[suiteList.length] = {
		// 				name: split[idx],
		// 				type: type,
		// 				range: new vscode.Range(
		// 					new vscode.Position(lineNo, lines[lineNo].indexOf(split[idx])),
		// 					new vscode.Position(lineNo, lines[lineNo].indexOf(split[idx]) + split[idx].length)
		// 				)
		// 			}
		// 		}
		// 		continue
		// 	}
		// }
		
		const classResult = classRE.exec(lines[lineNo])
		if (classResult) {
			const [, className] = classResult;
			// console.log("className=" + className + " isTestSuite=" + isTestSuite)
			const range = new vscode.Range(new vscode.Position(lineNo, lines[lineNo].indexOf(className)), new vscode.Position(lineNo, className.length));
			
			assertCount = 0;
			if (isTestSuite) {
				// console.log("isTestSuite=" + isTestSuite)
				// events.onTestSuite(range, "[TestSuite] " + className);
				// for (let idx=0; idx<suiteList.length; idx++) {
				// 	events.onTestClass(suiteList[idx]['range'], suiteList[idx]['name'])
				// }
				return
			} else {
				events.onTestClass(range, className);
			}
			continue;
		}
		// if (isTestSuite) {
		// 	//methods and procedures in a test suite file do not run
		// 	continue
		// }

		const proc = procedureRE.exec(lines[lineNo])
		if (proc) {
			const [ , blank, procedureName] = proc;
			// console.log("procedure=" + procedureName)
			const range = new vscode.Range(new vscode.Position(lineNo, lines[lineNo].indexOf(procedureName)), new vscode.Position(lineNo, procedureName.length));
			
			const prevLine = lines[lineNo - 1];
			if(prevLine.toLowerCase().indexOf("@test.") != -1) {
			var assertCount = 0;
				events.onTestProcedure(range, programName, procedureName);
				continue;
			}
		}

		const method = methodRE.exec(lines[lineNo]);
		if (method) {
			const [, publicKeyword, methodName] = method;
			// console.log("methodName=" + methodName)
			const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, method[0].length));
			
			const prevLine = lines[lineNo - 1];
			// console.log(prevLine.toLowerCase().indexOf("@test."))
			if(prevLine.toLowerCase().indexOf("@test.") != -1) {
				assertCount = 0;
				events.onTestMethod(range, className, methodName);
				continue;
			}
		}

		const assert = assertRE.exec(lines[lineNo]);
		if (assert) {
			assertCount++
			const [, assertMethod] = assert;
			// console.log("assertMethod=" + assertMethod + " assertCount=" + assertCount)
			const range = new vscode.Range(new vscode.Position(lineNo,lines[lineNo].indexOf(assertMethod)), new vscode.Position(lineNo, assertMethod.length))
			events.onAssert(range, '[' + assertCount + '] ' + assertMethod);
			continue;
		}
	}

	// if (isTestSuite) {
	// 	console.log("isTestSuite=" + isTestSuite)
	// 	events.onTestSuite(new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,0)), "[TestSuite] " + className);
	// 	for (let idx=0; idx<suiteList.length; idx++) {
	// 		events.onTestClass(suiteList[idx]['range'], suiteList[idx]['name'])
	// 	}
	// 	return
	// }
};
