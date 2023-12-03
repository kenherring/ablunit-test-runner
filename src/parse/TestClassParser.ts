import { Range,  WorkspaceFolder } from 'vscode'
import { logToChannel } from '../ABLUnitCommon'
import { getLines } from './TestParserCommon'

// CLASS statement
const classRE = /^\s*class\s+(\S+[^:])\s*/i
// METHOD statement
const methodRE = /\s+method\s(\s*public)?\s*(\S+)\s*(\S+\w)/i

interface IClassRet {
	classname: string
	label: string
	range: Range
	methods: [{
		methodname: string,
		range: Range
	}?]
}

export function parseABLTestClass (workspaceFolder: WorkspaceFolder, displayClassLabel: string, text: string, relativePath: string) {
	relativePath = relativePath.replace(/\\/g, '/')
	logToChannel("parsing " + relativePath)

	const [lines, foundAnnotation] = getLines(text, "@test")
	if(!foundAnnotation) {
		return
	}

	const classRet = parseTestClass(lines, displayClassLabel, relativePath)
	if (classRet.methods.length == 0) {
		return
	}
	return classRet
}

export function parseTestClass (lines: string[], configClassLabel: string, relativePath: string) {
	let foundClassHead = false
	const classRet: IClassRet = {
		classname: "",
		label: "",
		range: new Range(0,0,0,0),
		methods: []
	}

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		if (lines[lineNo] === "") {
			continue
		}

		//first find the class statement
		if (!foundClassHead) {
			const classResult = classRE.exec(lines[lineNo])
			if (classResult) {
				classRet.classname = classResult[1].replace(/:$/,'').trim()
				const range = new Range(lineNo, lines[lineNo].indexOf(classRet.classname), lineNo, classRet.classname.length)

				const parts = relativePath.split('/')
				classRet.label = parts[parts.length - 1]

				classRet.range = range
				foundClassHead = true
				continue
			}
		} else if (lines[lineNo - 1].toLowerCase().indexOf("@test.") != -1) {
			const method = methodRE.exec(lines[lineNo])
			if (method) {
				const [, , , methodname] = method
				const range = new Range(lineNo, lines[lineNo].indexOf(methodname), lineNo, methodname.length)
				classRet.methods?.push({methodname: methodname, range: range})
				continue
			}
		}
	}

	if (configClassLabel == "filepath") {
		classRet.classname = relativePath
	}
	return classRet
}
