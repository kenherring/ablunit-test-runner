import { Range } from 'vscode'
import { getAnnotationLines } from 'parse/TestParserCommon'

const onErrorRE = /(block|routine)-level\s+on\s+error/i
// CLASS statement
const classRE = /^\s*class\s+(\S+[^:])\s*/i
// METHOD statement
const methodRE = /\s*method\s(\s*public)?(\s*static)?\s*(\S+)\s*(\S+[\w#])/i

export interface ITestCase {
	label: string
	range: Range
}

export interface IClassRet {
	classname: string
	label: string
	range: Range
	missingOnError: boolean
	testcases: ITestCase[]
}

export function parseABLTestClass (displayClassLabel: string, text: string, relativePath: string) {
	relativePath = relativePath.replace(/\\/g, '/')

	const [lines, foundAnnotation] = getAnnotationLines(text, '@test')
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
		classname: '',
		label: '',
		range: new Range(0, 0, 0, 0),
		missingOnError: true,
		testcases: []
	}

	let lastNonBlankLineHasAnnotation = false
	const regexTest = /@test/i
	const regexIgnore = /^\s*@ignore\s*\.\s*$/i

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		if (onErrorRE.exec(lines[lineNo])) {
			classRet.missingOnError = false
		}
		if (lines[lineNo].trim() === '' || regexIgnore.exec(lines[lineNo])) {
			continue
		}

		// first find the class statement (if still needed)
		if (classRet.classname === '') {
			const classResult = classRE.exec(lines[lineNo])
			if (!classResult) { continue }

			classRet.classname = classResult[1].replace(/:$/, '').trim()
			classRet.range = new Range(lineNo, lines[lineNo].indexOf(classRet.classname), lineNo, classRet.classname.length)
			classRet.label = getClassLabel(configClassLabel, classRet.classname, relativePath)
			continue
		}

		// second, check for a test method on this line
		if (lastNonBlankLineHasAnnotation || lines[lineNo].toLowerCase().includes('@test')) {
			const method = methodRE.exec(lines[lineNo])
			if (method) {
				const [, , , , methodname] = method
				classRet.testcases.push({
					label: methodname,
					range: new Range(lineNo, lines[lineNo].indexOf(methodname), lineNo, methodname.length)
				})
			}
		}
		lastNonBlankLineHasAnnotation = false
		if (regexTest.exec(lines[lineNo])) {
			lastNonBlankLineHasAnnotation = true
		}
	}


	if (classRet.testcases.length == 0) {
		classRet.missingOnError = false
	}

	return classRet
}

function getClassLabel (configClassLabel: string, classname: string, relativePath: string) {
	if (configClassLabel == 'class-type-name') {
		return classname
	} else {
		return relativePath.split('/').pop() ?? 'UNDEFINED'
	}
}
