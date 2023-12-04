import { Range } from 'vscode'
import { getLines } from './TestParserCommon'

// PROCEDURE statement
const procedureRE = /(^|\s+)procedure\s+(\S+)\s*:/i

interface IProgramRet {
	label: string
	procedures: [{
		procedureName: string
		range: Range
	}?]
}

export function parseABLTestProgram (text: string, relativePath: string) {
	relativePath = relativePath.replace(/\\/g, '/')

	const [ lines, foundAnnotation ] = getLines(text, "@test")
	if(!foundAnnotation) {
		return
	}

	const programRet = parseTestProgram(lines, relativePath.split('/').reverse()[0])
	return programRet
}

function parseTestProgram (lines: string[], label: string) {

	const programRet: IProgramRet = {
		label: label,
		procedures: []
	}

	for (let lineNo = 1; lineNo < lines.length; lineNo++) {
		if (lines[lineNo] === "") {
			continue
		}

		if(lines[lineNo - 1].toLowerCase().indexOf("@test.") != -1) {
			const proc = procedureRE.exec(lines[lineNo])
			if (proc) {
				const [ , , procedureName] = proc
				const range = new Range(lineNo, lines[lineNo].indexOf(procedureName), lineNo, procedureName.length)
				programRet.procedures.push({
					procedureName: procedureName,
					range: range
				})
				continue
			}
		}
	}
	return programRet
}
