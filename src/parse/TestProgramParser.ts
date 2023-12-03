import { Position, Range, Uri, WorkspaceFolder } from 'vscode'
import { logToChannel } from '../ABLUnitCommon'
import { getLines } from './TestParserCommon'

// PROCEDURE statement
const procedureRE = /(^|\s+)procedure\s+(\S+)\s*:/i

export const parseABLTestProgram = (workspaceFolder: WorkspaceFolder, text: string, relativePath: string, events: {
	onTestProgramDirectory (range: Range, dirpath: string, dir: string, dirUri: Uri): void
	onTestProgram(range: Range, relativePath: string, label: string, suiteName?: string): void
	onTestProcedure(range: Range, relativePath: string, label: string): void
}) => {

	relativePath = relativePath.replace(/\\/g, '/')
	logToChannel("parsing " + relativePath)

	const [ lines, foundAnnotation ] = getLines(text, "@test")
	if(!foundAnnotation) {
		return
	}

	const zeroRange = new Range(new Position(0,0), new Position(0,0))

	const parseProgram = () => {
		const programRet = parseTestProgram(lines, relativePath, workspaceFolder.uri)
		if (programRet.procedures.length == 0) {
			return
		}

		for (const testProgramDir of programRet.testProgramDirs) {
			if(testProgramDir) {
				events.onTestProgramDirectory(zeroRange, testProgramDir.relativeTree, testProgramDir.part, testProgramDir.uri)
			}
		}

		events.onTestProgram(zeroRange, relativePath, programRet.label)

		for(const procedure of programRet.procedures) {
			if (procedure) {
				events.onTestProcedure(procedure.range, relativePath, procedure.procedureName)
			}
		}
	}

	parseProgram()
}

interface ITree {
	relativeTree: string,
	part: string,
	uri: Uri
}

interface IProgramRet {
	label: string
	testProgramDirs: ITree[]
	procedures: [{
		procedureName: string
		range: Range
	}?]
}

function getTestProgramDirs (workspaceDir: Uri, parts: string[]) {
	let relativeTree = ""
	const ret: ITree[] = []

	for (let idx=0; idx < parts.length - 1; idx++) {
		if (relativeTree == "") {
			relativeTree = parts[idx]
		} else {
			relativeTree = relativeTree + '/' + parts[idx]
		}
		ret.push({
			relativeTree: relativeTree,
			part: parts[idx],
			uri: Uri.joinPath(workspaceDir,relativeTree)
		})
	}
	return ret
}

function parseTestProgram (lines: string[], relativePath: string, workspaceDir: Uri) {

	const programRet: IProgramRet = {
		label: "",
		testProgramDirs: [],
		procedures: []
	}

	const parts = relativePath.split('/')

	programRet.testProgramDirs = getTestProgramDirs(workspaceDir, parts)
	programRet.label = parts[parts.length - 1]

	for (let lineNo = 1; lineNo < lines.length; lineNo++) {
		if (lines[lineNo] === "") {
			continue
		}

		if(lines[lineNo - 1].toLowerCase().indexOf("@test.") != -1) {
			const proc = procedureRE.exec(lines[lineNo])
			if (proc) {
				const [ , , procedureName] = proc
				const range = new Range(new Position(lineNo, lines[lineNo].indexOf(procedureName)), new Position(lineNo, procedureName.length))
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
