import { globSync } from 'glob'
import { WorkspaceFolder, commands, workspace } from 'vscode'
import { log } from './testCommon'

export function getRcodeCount (workspaceFolder?: WorkspaceFolder) {
	if (!workspaceFolder) {
		workspaceFolder = workspace.workspaceFolders?.[0]
	}
	if (!workspaceFolder) {
		throw new Error('workspaceFolder is undefined')
	}
	const g = globSync('**/*.r', { cwd: workspaceFolder?.uri.fsPath })
	const fileCount = g.length
	if (fileCount >= 0) {
		log.info('found ' + fileCount + ' r-code files')
		return fileCount
	}
	log.error('fileCount is not a number! fileCount=' + fileCount)
	return -1
}

export function rebuildAblProject () {
	log.info('[setRuntimes] rebuilding abl project...')
	return commands.executeCommand('abl.project.rebuild').then((r) => {
		log.info('[rebuildABlProject] r=' + JSON.stringify(r))
		const rcodeCount = getRcodeCount()
		log.info('[setRuntimes] abl.project.rebuild command complete! (rcodeCount=' + rcodeCount + ')')
		return rcodeCount
	}, (err) => {
		log.error('[setRuntimes] abl.project.rebuild failed! err=' + err)
		throw err
	})
}
