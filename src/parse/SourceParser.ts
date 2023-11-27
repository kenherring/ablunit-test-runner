import * as vscode from 'vscode'
import { logToChannel } from '../ABLUnitCommon'

// TESTSUITE statement
// const suiteRE = /@testsuite\((.*)\)/
const suiteItemRE = /(classes|procedures)="([^"]+)+"/i
const suiteItemRE2 = /,(classes|procedures)="([^"]+)+"/i
// CLASS statement
const classRE = /^\s*class\s+(\S+[^:])\s*/i
// const classRE = /^\s*class\s+(\S+)\s*(inherits)\s*(\S+)\s*:/i
// METHOD statement
const methodRE = /\s+method\s(\s*public)?\s*void\s*(\S[^\s:(]+)/i
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
	onTestSuite(range: vscode.Range, relativePath: string, suitename: string): void
	// onTestClassNamespace(range: vscode.Range, classpath: string, element: string, classpathUri: vscode.Uri): void
	onTestClass(range: vscode.Range, relativePath: string, classname: string, label: string, suiteName?: string): void
	onTestMethod(range: vscode.Range, relativePath: string, classname: string, methodname: string): void
	onTestProgramDirectory (range: vscode.Range, dirpath: string, dir: string, dirUri: vscode.Uri): void
	onTestProgram(range: vscode.Range, relativePath: string, label: string, programUri: vscode.Uri): void
	onTestProcedure(range: vscode.Range, relativePath: string, label: string, programUri: vscode.Uri): void
	onAssert(range: vscode.Range, methodname: string): void
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

	const parseByType = () => {
		if (relativePath.endsWith(".cls")) {
			if (text.toLowerCase().indexOf("@testsuite") != -1) {
				parseSuiteClass()
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

		const classRet = parseTestClass(lines, configClassLabel, relativePath, workspaceDir)

		for(const testProgramDir of classRet.testProgramDirs) {
			if(testProgramDir) {
				events.onTestProgramDirectory(zeroRange, testProgramDir.relativeTree, testProgramDir.part, testProgramDir.uri)
			}
		}
		events.onTestClass(classRet.range, relativePath, classRet.classname, classRet.label)
		for(const method of classRet.methods) {
			if(method) {
				events.onTestMethod(method.range, relativePath, classRet.classname, method.methodname)
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
					const [ , , procedureName] = proc
					const range = new vscode.Range(new vscode.Position(lineNo, lines[lineNo].indexOf(procedureName)), new vscode.Position(lineNo, procedureName.length))
					events.onTestProcedure(range, relativePath, procedureName, programUri)
					continue
				}
			}
		}
	}

	const parseSuiteClass = () => {
		const suiteRet = parseSuiteClassFunc(lines)
		events.onTestSuite(suiteRet.range, relativePath, suiteRet.name)
		for (const classEntry of suiteRet.classes) {
			events.onTestClass(suiteRet.range, classEntry, classEntry, classEntry, suiteRet.name)
		}
		// for (const procedureEntry of suiteRet.procedures) {
		// 	events.onTestProcedure(suiteRet.range, procedureEntry, procedureEntry, vscode.Uri.joinPath(workspaceDir,procedureEntry))
		// }
	}

	const parseSuiteProgram = () => {
		console.log("TODO - parseSuiteProgram - " + relativePath)
	}

	parseByType()

}


interface IClassRet {
	classname: string
	label: string
	range: vscode.Range
	testProgramDirs: [{
		relativeTree: string,
		part: string,
		uri: vscode.Uri
	}?]
	methods: [{
		methodname: string,
		range: vscode.Range
	}?]
}

export function parseTestClass (lines: string[], configClassLabel: string, relativePath: string, workspaceDir: vscode.Uri) {
	let foundClassHead = false
	const classRet: IClassRet = {
		classname: "",
		label: "",
		range: new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,0)),
		testProgramDirs: [],
		methods: []
	}

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {

		//first find the class statement
		if (!foundClassHead) {
			const classResult = classRE.exec(lines[lineNo])
			if (classResult) {
				classRet.classname = classResult[1].replace(/:$/,'').trim()
				const range = new vscode.Range(new vscode.Position(lineNo, lines[lineNo].indexOf(classRet.classname)), new vscode.Position(lineNo, classRet.classname.length))

				if (configClassLabel == "filepath") {
					classRet.classname = relativePath
				}

				const parts = relativePath.split('/')
				let relativeTree = ""
				for (let idx=0; idx < parts.length - 1; idx++) {
					if (relativeTree == "") {
						relativeTree = parts[idx]
					} else {
						relativeTree = relativeTree + '/' + parts[idx]
					}
					classRet.testProgramDirs.push({
						relativeTree: relativeTree,
						part: parts[idx],
						uri: vscode.Uri.joinPath(workspaceDir,relativeTree)
					})
				}
				classRet.label = parts[parts.length - 1]

				console.log("event.onTestClass-1 '" + relativePath + "' '" + classRet.classname + "' '" + classRet.label + "'" )
				classRet.range = range
				foundClassHead = true
				continue
			}
		} else if (lines[lineNo - 1].toLowerCase().indexOf("@test.") != -1) {
			const method = methodRE.exec(lines[lineNo])
			if (method) {
				const [, , methodname] = method
				const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, method[0].length))
				classRet.methods?.push({methodname: methodname, range: range})
				// console.log("events.onTestMethod: '" + classname + "' '" + methodname + "'")
				// events.onTestMethod(range, relativePath, classname, methodname)
				continue
			}
		}
	}
	return classRet
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

	const suiteList: SuiteLoc[] = []

	for (let lineNo = 1; lineNo < lines.length; lineNo++) {
		if (lines[lineNo].trim().startsWith("//"))
			continue
		// console.log("line[" + lineNo + "] = " + lines[lineNo])

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
