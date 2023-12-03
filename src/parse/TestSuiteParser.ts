import { Position, Range } from 'vscode'
import { logToChannel } from '../ABLUnitCommon'
import { getLines } from './TestParserCommon'

// CLASS statement
const classRE = /^\s*class\s+(\S+\w):?\s*/i

interface SuiteLoc {
	name: string
	type: string
	range: Range
}

export const parseABLTestSuite = (text: string, relativePath: string, events: {
	onTestSuite(range: Range, relativePath: string, suitename: string): void
	onTestClass(range: Range, relativePath: string, classname: string, label: string, suiteName: string): void
	onTestProgram(range: Range, relativePath: string, label: string, suiteName: string): void
}) => {

	relativePath = relativePath.replace(/\\/g, '/')
	logToChannel("parsing " + relativePath)

	const [ lines, foundAnnotation ] = getLines(text,"@testsuite")
	if (!foundAnnotation) {
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
			events.onTestClass(suiteRet.range, classEntry, classEntry, classEntry, suiteRet.name)
		}
		for (const procedureEntry of suiteRet.procedures) {
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
	range: Range,
	classes: string[],
	procedures: string[]
}

export function parseTestSuite (lines: string[]) {
	const suiteRet: ITestSuite = {
		name: "",
		range: new Range(new Position(0,0), new Position(0,0)),
		classes: [],
		procedures: []
	}

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		if (lines[lineNo] === "") {
			continue
		}

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
			suiteRet.range = new Range(new Position(lineNo, lines[lineNo].indexOf(className)), new Position(lineNo, className.length))
		}
	}

	return suiteRet
}

function parseAnnotation (suiteRes: RegExpExecArray | null) {
	if(!suiteRes) { return }

	let retClasses: string[] = []
	let retProcedures: string[] = []

	const [,details] = suiteRes

	if (details) {
		const classesRes = suiteClasses.exec(details)
		if (classesRes) {
			const [, classes] = classesRes
			retClasses = retClasses.concat(classes.split(','))
		}
		const proceduresRes = suiteProcedures.exec(details)
		if (proceduresRes) {
			const [, procedures] = proceduresRes
			retProcedures = retProcedures.concat(procedures.split(','))
		}
	}

	return [retClasses, retProcedures]
}
