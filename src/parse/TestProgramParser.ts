import { Range } from 'vscode'
import { getAnnotationLines } from './TestParserCommon'

// PROCEDURE statement
const procedureRE = /(^|\s+)procedure\s+(\S+)\s*:/i

interface ITestCase {
	label: string
	range: Range
}

export interface IProgramRet {
	label: string
	range: Range
	testcases: ITestCase[]
}

export function parseABLTestProgram (text: string, relativePath: string) {
	relativePath = relativePath.replace(/\\/g, '/')

	const [ lines, foundAnnotation ] = getAnnotationLines(text, '@test')
	if(!foundAnnotation) {
		return
	}

	const programRet = parseTestProgram(lines, relativePath.split('/').reverse()[0])
	return programRet
}

export function parseTestProgram (lines: string[], label: string) {

	const programRet: IProgramRet = {
		label: label,
		range: new Range(0, 0, 0, 0),
		testcases: []
	}

	let lastNonBlankLineHasAnnotation = false
	const regexTest = /@test/i
	const regexIgnore = /^\s*@ignore\s*\.\s*$/i

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		if (lines[lineNo].trim() === '' || regexIgnore.exec(lines[lineNo])) {
			continue
		}

		if(lastNonBlankLineHasAnnotation ||
			lines[lineNo].toLowerCase().includes('@test.')) {
			const proc = procedureRE.exec(lines[lineNo])
			if (proc) {
				const [ , , procedureName] = proc
				const range = new Range(lineNo, lines[lineNo].indexOf(procedureName), lineNo, procedureName.length)
				programRet.testcases.push({
					label: procedureName,
					range: range
				})
			}
		}
		lastNonBlankLineHasAnnotation = regexTest.exec(lines[lineNo]) != null
	}
	return programRet
}
