import * as assert from 'assert';
import { afterEach } from 'mocha';
import * as vscode from 'vscode';
import { doesDirExist, doesFileExist } from '../common'
import { getSessionTempDir } from '../indexCommon';

const projName = 'proj4'
const sessionTempDir = vscode.Uri.parse(getSessionTempDir())


afterEach(async () => {
	await vscode.workspace.getConfiguration('ablunit').update('profilerOptions.listings','c:\\temp\\ablunit-local\\listings')
})

suite('Extension Test Suite - ' + projName, () => {

	test('proj4 - Absolute Paths', async () => {
		const listingsDir = vscode.Uri.joinPath(sessionTempDir,'listings')
		const resultsXml = vscode.Uri.joinPath(sessionTempDir,'tempDir','results.xml')
		await vscode.workspace.getConfiguration('ablunit').update('profilerOptions.listings', listingsDir.fsPath)
		await vscode.workspace.getConfiguration('ablunit').update('tempDir', vscode.Uri.joinPath(sessionTempDir,'tempDir').fsPath)

		await vscode.commands.executeCommand('testing.refreshTests')
		await vscode.commands.executeCommand('workbench.view.testing.focus')

		console.log("sleeping for 1s while tests are discovered") //There's gotta be a better way to do this...
		await new Promise( resolve => setTimeout(resolve, 1000))

		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		assert(await doesFileExist(resultsXml),"missing results file (" + resultsXml.fsPath + ")")
		assert(await doesDirExist(listingsDir),"missing listings directory (" + listingsDir.fsPath + ")")
	})

})
