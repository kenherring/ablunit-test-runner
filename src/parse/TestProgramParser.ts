import * as vscode from 'vscode'
import { logToChannel } from '../ABLUnitCommon'

// PROCEDURE statement
const procedureRE = /(^|\s+)procedure\s+(\S+)\s*:/i

export const parseABLTestProgram = (text: string, relativePath: string, events: {
	onTestProgramDirectory (range: vscode.Range, dirpath: string, dir: string, dirUri: vscode.Uri): void
	onTestProgram(range: vscode.Range, relativePath: string, label: string, programUri: vscode.Uri, suiteName?: string): void
	onTestProcedure(range: vscode.Range, relativePath: string, label: string, programUri: vscode.Uri): void
}) => {

	relativePath = relativePath.replace(/\\/g, '/')
	logToChannel("parsing " + relativePath)

	const lines = text.replace(/\r/g,'').split("\n")
	if (!vscode.workspace.workspaceFolders) {
		return
	}
	const workspaceDir = vscode.workspace.workspaceFolders.map(item => item.uri)[0]
	const zeroRange = new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,0))

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

	parseProgram()

}
