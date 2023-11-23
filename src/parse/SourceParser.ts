import * as vscode from 'vscode';
import { logToChannel } from '../ABLUnitCommon';

// TESTSUITE statement
const suiteRE = /@testsuite\((.*)\)/
const suiteItemRE = /(classes|procedures)="([^"]+)+"/i
const suiteItemRE2 = /,(classes|procedures)="([^"]+)+"/i
// CLASS statement
const classRE = /^\s*class\s+(\S+)\s*/i
// const classRE = /^\s*class\s+(\S+)\s*(inherits)\s*(\S+)\s*:/i
// METHOD statement
const methodRE = /\s+method\s(\s*public)?\s*void\s*(\S[^\s(]+)/i
// PROCEDURE statement
const procedureRE = /(^|\s+)procedure\s+(\S+)\s*:/i
// ASSERT method call
const assertRE = /(OpenEdge.Core.Assert:\S+\s*\(.*\))/i

interface SuiteLoc {
	name: string
	type: string
	range: vscode.Range
}

export const parseABLUnit = (text: string, relativePath: string, events: {
	onTestSuite(range: vscode.Range, suitename: string): void;
	onTestClassNamespace(range: vscode.Range, classpath: string, element: string, classpathUri: vscode.Uri): void;
	onTestClass(range: vscode.Range, relativePath: string, classname: string, label: string): void;
	onTestMethod(range: vscode.Range, classname: string, methodname: string): void;
	onTestProgramDirectory (range: vscode.Range, dirpath: string, dir: string, dirUri: vscode.Uri): void
	onTestProgram(range: vscode.Range, relativePath: string, label: string, programUri: vscode.Uri): void;
	onTestProcedure(range: vscode.Range, relativePath: string, label: string, programUri: vscode.Uri): void;
	onAssert(range: vscode.Range, methodname: string): void;
}) => {

	relativePath = relativePath.replace(/\\/g, '/')
	logToChannel("parsing " + relativePath)

	const lines = text.split("\n")
	const configClassLabel= vscode.workspace.getConfiguration('ablunit').get('display.classLabel');
	if (!vscode.workspace.workspaceFolders) return
	const workspaceDir = vscode.workspace.workspaceFolders.map(item => item.uri)[0];
	const zeroRange = new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,0))

	const parseByType = () => {
		if (relativePath.endsWith(".cls")) {
			if (text.toLowerCase().indexOf("@testsuite") != -1) {
				// if (false) {
				// 	//TODO
				// 	parseSuiteClass()
				// }
				return
			}
			parseClass()
		} else if (relativePath.endsWith(".p")) {
			if (text.toLowerCase().indexOf("@testsuite") != -1) {
				parseSuiteProgram()
				return
			}
			parseProgram()
		}
	}

	const parseClass = () => {
		if (text.toLowerCase().indexOf("@test.") == -1) {
			return
		}

		let foundClassHead = false
		let classname: string = ""

		for (let lineNo = 0; lineNo < lines.length; lineNo++) {

			//first find the class statement
			if (!foundClassHead) {
				const classResult = classRE.exec(lines[lineNo])
				if (classResult) {
					classname = classResult[1].replace(/:$/,'');
					const range = new vscode.Range(new vscode.Position(lineNo, lines[lineNo].indexOf(classname)), new vscode.Position(lineNo, classname.length));

					if (configClassLabel == "filepath") {
						classname = relativePath;
					}

					const parts = relativePath.split('/')
					let relativeTree = ""
					for (let idx=0; idx < parts.length - 1; idx++) {
						if (relativeTree == "") {
							relativeTree = parts[idx]
						} else {
							relativeTree = relativeTree + '/' + parts[idx]
						}
						events.onTestProgramDirectory(zeroRange, relativeTree, parts[idx], vscode.Uri.joinPath(workspaceDir,relativeTree))
					}
					const label = parts[parts.length - 1]

					events.onTestClass(range, relativePath, classname, label);
					foundClassHead = true
					continue;
				}
			} else if (lines[lineNo - 1].toLowerCase().indexOf("@test.") != -1) {
				const method = methodRE.exec(lines[lineNo]);
				if (method) {
					const [, , methodname] = method;
					const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, method[0].length));
					events.onTestMethod(range, classname, methodname);
					continue;
				}
			}
		}
	}

	const parseProgram = () => {
		if (text.toLowerCase().indexOf("@test.") == -1) {
			return
		}

		const programUri = vscode.Uri.joinPath(workspaceDir,relativePath)

		const parts = relativePath.split('/')
		let relativeTree = ""
		for (let idx=0; idx < parts.length - 1; idx++) {
			if (relativeTree == "") {
				relativeTree = parts[idx]
			} else {
				relativeTree = relativeTree + '/' + parts[idx]
			}
			events.onTestProgramDirectory(zeroRange, relativeTree, parts[idx], vscode.Uri.joinPath(workspaceDir,relativeTree))
		}
		const label = parts[parts.length - 1]
		events.onTestProgram(zeroRange, relativePath, label, programUri)

		for (let lineNo = 1; lineNo < lines.length; lineNo++) {
			if(lines[lineNo - 1].toLowerCase().indexOf("@test.") != -1) {
				const proc = procedureRE.exec(lines[lineNo])
				if (proc) {
					const [ , , procedureName] = proc;
					const range = new vscode.Range(new vscode.Position(lineNo, lines[lineNo].indexOf(procedureName)), new vscode.Position(lineNo, procedureName.length));
					events.onTestProcedure(range, relativePath, procedureName, programUri)
					continue;
				}
			}
		}
	};

	const parseSuiteClass = () => {

		events.onTestSuite(new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,0)), '[suite] ' + relativePath)

		const suiteList: SuiteLoc[] = []

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
						for (const element of split) {
							suiteList[suiteList.length] = {
								name: element,
								type: type,
								range: new vscode.Range(
									new vscode.Position(lineNo, lines[lineNo].indexOf(element)),
									new vscode.Position(lineNo, lines[lineNo].indexOf(element) + element.length)
								)
							}
						}
					}

					//TODO: how can we better find all the params?
					const cr2 = suiteItemRE2.exec(params)
					if(cr2) {
						const [, type2, list2] = cr2
						const split = list2.split(',')
						for (const element of split) {
							suiteList[suiteList.length] = {
								name: element,
								type: type2,
								range: new vscode.Range(
									new vscode.Position(lineNo, lines[lineNo].indexOf(element)),
									new vscode.Position(lineNo, lines[lineNo].indexOf(element) + element.length)
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

					for (const element of suiteList) {
						events.onTestClass(element['range'], element['name'], element['name'], element['name'])
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
