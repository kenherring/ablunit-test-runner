import { DecorationOptions, Range, TextEditor, window, workspace } from "vscode";
import { ABLResults } from "./ABLResults";

let recentResults: ABLResults[] | undefined

const backgroundExecutable = window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255,0,0,0.1)',
})
const backgroundExecuted = window.createTextEditorDecorationType({
	backgroundColor: 'rgba(0,255,0,0.1)',
})

export function setRecentResults(results: ABLResults[]) {
	recentResults = results
}

export function decorate(editor: TextEditor) {
	const executedArray: DecorationOptions[] = []
	const executableArray: DecorationOptions[] = []

	if(!recentResults || recentResults.length == 0) { return }

	const wf = workspace.getWorkspaceFolder(editor.document.uri)
	const idx = recentResults.findIndex(r => r.workspaceFolder === wf)
	if (idx < 0) { return }

	const tc = recentResults[idx].testCoverage.get(editor.document.uri.fsPath)
	if (!tc) { return }

	tc.detailedCoverage?.forEach(element => {
		const range = <Range> element.location
		const decoration = { range }
		if (element.executionCount > 0) {
			executedArray.push(decoration)
		} else {
			executableArray.push(decoration)
		}
	})

	editor.setDecorations(backgroundExecuted, executedArray)
	editor.setDecorations(backgroundExecutable, executableArray)
}
