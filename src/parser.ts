import * as vscode from 'vscode';

// TODO - If the XREF is available let's try to parse that instead


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

export const parseABLUnit = (text: string, relativePath: string, events: {
	onTestSuite(range: vscode.Range, suitename: string): void;
	onTestClassNamespace(range: vscode.Range, classpath: string, element: string): void;
	onTestClass(range: vscode.Range, classname: string, label: string): void;
	onTestProgram(range: vscode.Range, procedureName: string): void;
	onTestMethod(range: vscode.Range, classname: string, methodname: string): void;
	onTestProcedure(range: vscode.Range, programname: string, prcocedurename: string): void;
	onAssert(range: vscode.Range, methodname: string): void;
}) => {
	
	const lines = text.split("\n")
	const configStyle = vscode.workspace.getConfiguration('ablunit').get('display.style');
	const configClassLabel= vscode.workspace.getConfiguration('ablunit').get('display.classLabel');
	// console.log("configStyle=" + configStyle + ", configClassLabel=" + configClassLabel)

	const parseByType = () => {
		if (relativePath.endsWith(".cls")) {
			if (text.toLowerCase().indexOf("@testsuite") != -1) {
				parseSuiteClass()
				return
			}
			parseClass()
			return
		} else if (relativePath.endsWith(".p")) {
			if (text.toLowerCase().indexOf("@testsuite") != -1) {
				parseSuiteProgram()
				return
			}
			parseProgram()
			return
		}
	}

	const splitpath = (path: string) => {
		var elems = []
		elems = path.split('.')
		if (elems.length > 1) return elems
		elems = path.split('/')
		if (elems.length > 1) return elems
		elems = path.split('\\')
		return elems
	}

	const parseClass = () => {
		if (text.toLowerCase().indexOf("@test.") == -1) {
			return
		}

		var assertCount: number = 0
		var foundClassHead = false
		var className: string = ""

		for (let lineNo = 0; lineNo < lines.length; lineNo++) {

			//first find the class statement
			if (!foundClassHead) {
				const classResult = classRE.exec(lines[lineNo])
				if (classResult) {
					className = classResult[1];
					const range = new vscode.Range(new vscode.Position(lineNo, lines[lineNo].indexOf(className)), new vscode.Position(lineNo, className.length));

					if (configClassLabel == "filepath") {
						// className = 
						className = relativePath;
					}
					
					var label = className
					if (configStyle == "tree") {
						var path = splitpath(className)
						var classpath: string = ""
						for (let idx=0; idx < path.length - 1; idx++) {
							if (classpath == "") 
								classpath = path[idx]
							else
								classpath = classpath + "." + path[idx]
							events.onTestClassNamespace(range, classpath, path[idx])
						}
						label = path[path.length - 1]
					}
					events.onTestClass(range, className, label);
					foundClassHead = true
					continue;
				}
			} else {
				//second, find all the @test methods
				if (lines[lineNo - 1].toLowerCase().indexOf("@test.") != -1) {
					const method = methodRE.exec(lines[lineNo]);
					if (method) {
						const [, publicKeyword, methodName] = method;
						const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, method[0].length));
						assertCount = 0;
						events.onTestMethod(range, className, methodName);
						continue;
					}
				}
			}
		}
	}

	const parseProgram = () => {
		if (text.toLowerCase().indexOf("@test.") == -1) {
			return
		}

		for (let lineNo = 1; lineNo < lines.length; lineNo++) {
			if(lines[lineNo - 1].toLowerCase().indexOf("@test.") != -1) {
				const proc = procedureRE.exec(lines[lineNo])
				if (proc) {
					const [ , blank, procedureName] = proc;
					const range = new vscode.Range(new vscode.Position(lineNo, lines[lineNo].indexOf(procedureName)), new vscode.Position(lineNo, procedureName.length));
					var assertCount = 0;
					events.onTestProcedure(range, "", procedureName);
					continue;
				}
			}
		}
	};

	// TESTSUITE statement
	const suiteRE = /@testsuite\((.*)\)/
	const suiteItemRE = /(classes|procedures)="([^"]*)+"/i
	const suiteItemRE2 = /,(classes|procedures)="([^"]*)+"/i

	const parseSuiteClass = () => {

		events.onTestSuite(new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,0)), '[suite] ' + relativePath)

		var suiteList: SuiteLoc[] = []

		for (let lineNo = 1; lineNo < lines.length; lineNo++) {
			if (lines[lineNo].trim().startsWith("//"))
				continue
			if(lines[lineNo].toLowerCase().indexOf("@testsuite") != -1) {
				const suiteRes = suiteRE.exec(lines[lineNo])
				if (suiteRes) {
					const [ , params] = suiteRes
					const cr = suiteItemRE.exec(params)
					if(cr) {
						const [, type, list] = cr
						const split = list.split(',')
						for (let idx=0; idx<split.length; idx++) {
							suiteList[suiteList.length] = {
								name: split[idx],
								type: type,
								range: new vscode.Range(
									new vscode.Position(lineNo, lines[lineNo].indexOf(split[idx])),
									new vscode.Position(lineNo, lines[lineNo].indexOf(split[idx]) + split[idx].length)
								)
							}
						}
					}

					//TODO: how can we better find all the params?
					const cr2 = suiteItemRE2.exec(params)
					if(cr2) {
						const [, type2, list2] = cr2
						const split = list2.split(',')
						for (let idx=0; idx<split.length; idx++) {
							suiteList[suiteList.length] = {
								name: split[idx],
								type: type2,
								range: new vscode.Range(
									new vscode.Position(lineNo, lines[lineNo].indexOf(split[idx])),
									new vscode.Position(lineNo, lines[lineNo].indexOf(split[idx]) + split[idx].length)
								)
							}
						}
					}
					continue
				}
			} else {
				const classResult = classRE.exec(lines[lineNo])
				if (classResult) {
					const [, className] = classResult;
					const range = new vscode.Range(new vscode.Position(lineNo, lines[lineNo].indexOf(className)), new vscode.Position(lineNo, className.length));
					events.onTestSuite(range, className);
					
					for (let idx=0; idx<suiteList.length; idx++) {
						events.onTestClass(suiteList[idx]['range'], suiteList[idx]['name'], suiteList[idx]['name'])
					}

					return
				}
			}
		}
	}
	
	const parseSuiteProgram = () => {
		console.log("TODO - parseSuiteProgram - " + relativePath)
	}
	
	parseByType()

};
