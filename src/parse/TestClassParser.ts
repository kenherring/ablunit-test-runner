import { Range } from 'vscode'
import { getLines } from './TestParserCommon'

// CLASS statement
const classRE = /^\s*class\s+(\S+[^:])\s*/i
// METHOD statement
const methodRE = /\s*method\s(\s*public)?(\s*static)?\s*(\S+)\s*(\S+\w)/i

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
	const classRet: IClassRet = {
		classname: "",
		label: "",
		range: new Range(0,0,0,0),
		testcases: []
	}

	let lastNonBlankLineHasAnnotation = false
	const regexTest = /@test\./i

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		if (lines[lineNo].trim() === "") {
			continue
		}

		// first find the class statement
		if (classRet.classname === "") {
			const classResult = classRE.exec(lines[lineNo])
			if (!classResult) { continue }

			classRet.classname = classResult[1].replace(/:$/,'').trim()
			classRet.range = new Range(lineNo, lines[lineNo].indexOf(classRet.classname), lineNo, classRet.classname.length)
			classRet.label = getClassLabel(configClassLabel, classRet.classname, relativePath)
			continue
		}

		if (lastNonBlankLineHasAnnotation || lines[lineNo].toLowerCase().indexOf("@test.") != -1) {
			const method = methodRE.exec(lines[lineNo])
			if (method) {
				const [, , , , methodname] = method
				classRet.testcases.push({
					label: methodname,
					range: new Range(lineNo, lines[lineNo].indexOf(methodname), lineNo, methodname.length)
				})
			}
		}
		lastNonBlankLineHasAnnotation = regexTest.exec(lines[lineNo]) != null
	}

	return classRet
}

function getClassLabel (configClassLabel: string, classname: string, relativePath: string) {
	if (configClassLabel == "class-type-name") {
		return classname
	} else {
		return relativePath.split('/').pop() ?? 'UNDEFINED'
	}
}
