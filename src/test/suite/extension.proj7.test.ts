import * as vscode from 'vscode'
import * as assert from 'assert'
import path = require('path')
import { before } from 'mocha'
import { getTestCount } from '../common'

const projName = 'proj0'

function getUri (path: string) {
	return vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, path)
}

before(async () => {
	const templateProc = vscode.Uri.joinPath(getUri('src/template_proc.p'))
	const templateClass = vscode.Uri.joinPath(getUri('src/template_class.cls'))
	const classContent = await vscode.workspace.fs.readFile(templateClass).then((data) => {
		return data.toString()
	})

	for (let i = 0; i < 10; i++) {
		await vscode.workspace.fs.createDirectory(getUri('src/procs/dir' + i))
		await vscode.workspace.fs.createDirectory(getUri('src/classes/dir' + i))
		for (let j = 0; j < 10; j++) {
			await vscode.workspace.fs.copy(templateProc, getUri(`src/procs/dir${i}/testProc${j}.p`), { overwrite: true })

			const writeContent = Uint8Array.from(Buffer.from(classContent.replace(/template_class/, `classes.dir${i}.testClass${j}`)))
			await vscode.workspace.fs.writeFile(getUri(`src/classes/dir${i}/testClass${j}.cls`), writeContent)
		}
	}
})

suite('SourceParser Test Suite - proj7', () => {

	test('testCount', async () => {
		await vscode.commands.executeCommand('testing.refreshTests')
		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		const resultsJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'temp','results.json')
		const testCount = await getTestCount(resultsJson)
		console.log("getTestCount: " + testCount)
		assert(testCount > 1000, "testCount should be > 100, but is " + testCount)
	})

})
