import * as assert from 'assert';
import { after, before } from 'mocha';
import * as vscode from 'vscode';
import { doesDirExist, doesFileExist } from '../common'
import { getDefaultDLC, setRuntimes } from '../indexCommon';

const projName = 'proj3'

before(async () => {
	await setRuntimes([{name: "11.7", path: "/psc/dlc_11.7"}, {name: "12.2", path: getDefaultDLC(), default: true}])
})

after(() => {
	console.log("after")
})

suite('Extension Test Suite - ' + projName, () => {

	test('target/ablunit.json file exists', async () => {
		const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'target','ablunit.json')
		const resultsXml = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'ablunit-output','results.xml')
		const listingsDir = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'target','listings')

		await vscode.commands.executeCommand('testing.refreshTests');
		await vscode.commands.executeCommand('workbench.view.testing.focus')

		console.log("sleeping for 2s while tests are discovered") //There's gotta be a better way to do this...
		await new Promise( resolve => setTimeout(resolve, 2000))

		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(await doesDirExist(listingsDir),"missing listings directory (" + listingsDir.fsPath + ")")
	})

})
