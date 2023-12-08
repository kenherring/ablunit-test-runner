import { Range } from 'vscode'
import { getLines } from './TestParserCommon'

// CLASS statement
const classRE = /^\s*class\s+(\S+[^:])\s*/i
// METHOD statement
const methodRE = /\s+method\s(\s*public)?\s*(\S+)\s*(\S+\w)/i

export interface ITestCase {
	label: string
	range: Range
}

export interface IClassRet {
	classname: string
	label: string
	range: Range
	testcases: ITestCase[]
}

export function parseABLTestClass (displayClassLabel: string, text: string, relativePath: string) {
	relativePath = relativePath.replace(/\\/g, '/')

	const [lines, foundAnnotation] = getLines(text, "@test")
	if(!foundAnnotation) {
		return
	}

	const classRet = parseTestClass(lines, displayClassLabel, relativePath)
	if (classRet.testcases.length == 0) {
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
		testcases: []
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
				classRet.testcases.push({label: methodname, range: range})
				continue
			}
		}
	}

	if (configClassLabel == "class-type-name") {
		classRet.label = classRet.classname
	}
	return classRet
}
