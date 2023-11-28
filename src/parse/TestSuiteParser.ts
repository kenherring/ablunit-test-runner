import * as vscode from 'vscode'
import { logToChannel } from '../ABLUnitCommon'

// CLASS statement
const classRE = /^\s*class\s+(\S+[^:])\s*/i

interface SuiteLoc {
	name: string
	type: string
	range: vscode.Range
}

export const parseABLTestSuite = (text: string, relativePath: string, events: {
	onTestSuite(range: vscode.Range, relativePath: string, suitename: string): void
	onTestClass(range: vscode.Range, relativePath: string, classname: string, label: string, suiteName: string): void
	onTestProgram(range: vscode.Range, relativePath: string, label: string, programUri: vscode.Uri, suiteName: string): void
}) => {

	relativePath = relativePath.replace(/\\/g, '/')
	logToChannel("parsing " + relativePath)

	const lines = text.replace(/\r/g,'').split("\n")
	const configClassLabel = vscode.workspace.getConfiguration('ablunit').get('display.classLabel','')
	if (!vscode.workspace.workspaceFolders) {
		return
	}
	const workspaceDir = vscode.workspace.workspaceFolders.map(item => item.uri)[0]
	const zeroRange = new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,0))

	const parseSuiteClass = () => {
		const suiteRet = parseSuiteClassFunc(lines)
		events.onTestSuite(suiteRet.range, relativePath, suiteRet.name)
		for (const classEntry of suiteRet.classes) {
			console.log("onTestClass: " + classEntry)
			events.onTestClass(suiteRet.range, classEntry, classEntry, classEntry, suiteRet.name)
		}
		for (const procedureEntry of suiteRet.procedures) {
			console.log("onTestProcedure: " + procedureEntry)
			events.onTestProgram(suiteRet.range, procedureEntry, procedureEntry, vscode.Uri.joinPath(workspaceDir,procedureEntry), suiteRet.name)
		}
	}

	parseSuiteClass()

}

const suiteRE = /@testsuite\s*\(((classes|procedures).*)\)/i
const suiteClasses = /classes\s*=\s*"([^"]+)+"/i
const suiteProcedures = /procedures\s*=\s*"([^"]+)+"/i

export interface ITestSuite {
	name: string,
	range: vscode.Range,
	classes: string[],
	procedures: string[]
}

export function parseSuiteClassFunc (lines: string[]) {
	const suiteRet: ITestSuite = {
		name: "",
		range: new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,0)),
		classes: [],
		procedures: []
	}

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		if (lines[lineNo].trim().startsWith("//"))
			continue
		console.log("line[" + lineNo + "] = " + lines[lineNo])

		// console.log("lines[lineNo].toLowerCase()=" + lines[lineNo].toLowerCase())
		// console.log("lines[lineNo].toLowerCase().indexOf(testsuite)=" + lines[lineNo].toLowerCase().indexOf("@testsuite"))
		if(lines[lineNo].toLowerCase().indexOf("@testsuite") != -1) {
			// console.log("annotation-1")
			const suiteRes = suiteRE.exec(lines[lineNo])
			if(suiteRes) {
				const [,details] = suiteRes
				// console.log("annotation-2: " + details)
				if (details) {
					console.log("FOUND ANNOTATION: " + details)
					const classesRes = suiteClasses.exec(details)
					if (classesRes) {
						const [, classes] = classesRes
						console.log("FOUND CLASSES: " + classes.split(','))
						suiteRet.classes = suiteRet.classes.concat(classes.split(','))
					}
					const proceduresRes = suiteProcedures.exec(details)
					if (proceduresRes) {
						const [, procedures] = proceduresRes
						console.log("FOUND PROCEDURES: " + procedures.split(','))
						suiteRet.procedures = suiteRet.procedures.concat(procedures.split(','))
					}
				}
			}
			continue
		}

		const classResult = classRE.exec(lines[lineNo])
		console.log("classResult=" + JSON.stringify(classResult))
		if (classResult) {
			console.log("lines[lineNo]=" + lines[lineNo])
			const [, className] = classResult
			console.log("SUITE CLASS: " + className)
			suiteRet.name = className
			suiteRet.range = new vscode.Range(new vscode.Position(lineNo, lines[lineNo].indexOf(className)), new vscode.Position(lineNo, className.length))
		}
	}

	console.log("suiteRet=" + JSON.stringify(suiteRet))
	return suiteRet
}
