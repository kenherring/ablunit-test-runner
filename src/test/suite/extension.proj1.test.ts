import * as assert from 'assert';
import { after, before } from 'mocha';
import * as vscode from 'vscode';
import { doesFileExist } from '../common'

const projName = 'proj1'

before(async () => {
    console.log("before")
});

after(() => {
	console.log("after")
});

suite('Extension Test Suite - ' + projName, () => {

	test('ablunit.json file exists', async () => {
		const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'ablunit.json')
		const resultsXml = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'results.xml')

		await vscode.commands.executeCommand('testing.refreshTests');
		await vscode.commands.executeCommand('workbench.view.testing.focus')
		console.log("sleeping for 2s while tests are discovered") //There's gotta be a better way to do this...
		await new Promise( resolve => setTimeout(resolve, 2000))
		const val1 = await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		console.log("check-1")
		assert(doesFileExist(ablunitJson))
		console.log("check-2")
		assert(doesFileExist(resultsXml))
		console.log("check-3")

		console.log("ablunitJson: " + ablunitJson.fsPath)
		console.log("resultsXml:" + resultsXml.fsPath)

		await vscode.workspace.fs.stat(resultsXml).then((stat) => {
			assert(stat.type === vscode.FileType.File)
		}, (err) => {
			console.log("results.xml file does not exist (" + resultsXml.fsPath + "): " + err)
			assert.fail("results.xml file does not exist: " + err)
		})
		console.log("check-3")
	});

	test('wrap up', () => {
		assert.equal(1,1);
	})

});
