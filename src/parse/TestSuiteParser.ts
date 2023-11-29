import * as vscode from 'vscode'
import { logToChannel } from '../ABLUnitCommon'

// CLASS statement
const classRE = /^\s*class\s+(\S+\w):?\s*/i

interface SuiteLoc {
	name: string
	type: string
	range: vscode.Range
}

export const parseABLTestSuite = (text: string, relativePath: string, events: {
	onTestSuite(range: vscode.Range, relativePath: string, suitename: string): void
	onTestClass(range: vscode.Range, relativePath: string, classname: string, label: string, suiteName: string): void
	onTestProgram(range: vscode.Range, relativePath: string, label: string, suiteName: string): void
}) => {

	relativePath = relativePath.replace(/\\/g, '/')
	logToChannel("parsing " + relativePath)

	const lines = text.replace(/\r/g,'').split("\n")
	if (!vscode.workspace.workspaceFolders) {
		return
	}

	const parseSuite = () => {
		const suiteRet = parseTestSuite(lines)
		if (suiteRet.classes.length == 0 && suiteRet.procedures.length == 0) {
			return
		}

		if (suiteRet.name === "") {
			suiteRet.name = relativePath
		}

		events.onTestSuite(suiteRet.range, relativePath, suiteRet.name)
		for (const classEntry of suiteRet.classes) {
			console.log("onTestClass: " + classEntry)
			events.onTestClass(suiteRet.range, classEntry, classEntry, classEntry, suiteRet.name)
		}
		for (const procedureEntry of suiteRet.procedures) {
			console.log("onTestProcedure: " + procedureEntry)
			events.onTestProgram(suiteRet.range, procedureEntry, procedureEntry, suiteRet.name)
		}
	}

	parseSuite()
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

export function parseTestSuite (lines: string[]) {
	const suiteRet: ITestSuite = {
		name: "",
		range: new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,0)),
		classes: [],
		procedures: []
	}

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {

		if(lines[lineNo].toLowerCase().indexOf("@testsuite") != -1) {
			const suiteRes = suiteRE.exec(lines[lineNo])

			const r = parseAnnotation(suiteRes)
			if (r) {
				suiteRet.classes = suiteRet.classes.concat(r[0])
				suiteRet.procedures = suiteRet.procedures.concat(r[1])
			}
			continue
		}

		const classResult = classRE.exec(lines[lineNo])
		if (classResult) {
			const [, className] = classResult
			suiteRet.name = className
			suiteRet.range = new vscode.Range(new vscode.Position(lineNo, lines[lineNo].indexOf(className)), new vscode.Position(lineNo, className.length))
		}
	}

	console.log("suiteRet=" + JSON.stringify(suiteRet))
	return suiteRet
}

function parseAnnotation (suiteRes: RegExpExecArray | null) {
	if(!suiteRes) { return }

	let retClasses: string[] = []
	let retProcedures: string[] = []

	const [,details] = suiteRes

	if (details) {
		console.log("FOUND ANNOTATION: " + details)
		const classesRes = suiteClasses.exec(details)
		if (classesRes) {
			const [, classes] = classesRes
			console.log("FOUND CLASSES: " + classes.split(','))
			retClasses = retClasses.concat(classes.split(','))
		}
		const proceduresRes = suiteProcedures.exec(details)
		if (proceduresRes) {
			const [, procedures] = proceduresRes
			console.log("FOUND PROCEDURES: " + procedures.split(','))
			retProcedures = retProcedures.concat(procedures.split(','))
		}
	}

	return [retClasses, retProcedures]
}
