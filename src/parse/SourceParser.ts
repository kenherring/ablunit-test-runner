import * as vscode from 'vscode'
import { logToChannel } from '../ABLUnitCommon'

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
	onTestClass(range: vscode.Range, relativePath: string, classname: string, label: string, suiteName?: string): void
	onTestMethod(range: vscode.Range, relativePath: string, classname: string, methodname: string): void
	onTestProgramDirectory (range: vscode.Range, dirpath: string, dir: string, dirUri: vscode.Uri): void
	onTestProgram(range: vscode.Range, relativePath: string, label: string, programUri: vscode.Uri, suiteName?: string): void
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
			parseClass()
		} else if (relativePath.endsWith(".p")) {
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
