import * as assert from 'assert';
import { after, before } from 'mocha';
import * as vscode from 'vscode';
import { getStorageUri } from '../../extension'
import { doesFileExist } from '../common'


const projName = 'proj0'

before(async () => {
    console.log("before")
});

after(() => {
	console.log("after")
});

suite('Extension Test Suite - ' + projName, () => {

	test('<storageUri>/ablunit.json file exists', async () => {
		console.log("test-1")


		await vscode.commands.executeCommand('testing.refreshTests');
		await vscode.commands.executeCommand('workbench.view.testing.focus')
		console.log("sleeping for 2s while tests are discovered") //There's gotta be a better way to do this...
		await new Promise( resolve => setTimeout(resolve, 2000))
		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		const storageUri = getStorageUri()
		if (!storageUri) {
			assert.fail("storage uri not defined")
			return
		}
		console.log("test-2")
		const ablunitJson = vscode.Uri.joinPath(storageUri,'ablunit.json')
		const resultsXml = vscode.Uri.joinPath(storageUri,'results.xml')

		console.log("ablunitJson: " + ablunitJson.fsPath)

		assert(doesFileExist(ablunitJson))
		assert(doesFileExist(resultsXml))
		await vscode.workspace.fs.stat(ablunitJson).then((stat) => {
			assert(stat.type === vscode.FileType.File)
		}, (err) => {
			console.log("ablunit.json file does not exist (" + ablunitJson.fsPath + "): " + err)
			assert.fail("ablunit.json file does not exist: " + err)
		})

		console.log("Test-1 success")

	});

	test('wrap up', () => {
		console.log("Test-2 wrap up")
		assert.equal(1,1);
	})

});
