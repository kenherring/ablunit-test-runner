import * as assert from 'assert';
import { after, before } from 'mocha';
import * as vscode from 'vscode';

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

		await vscode.commands.executeCommand('testing.refreshTests');
		await vscode.commands.executeCommand('workbench.view.testing.focus')
		console.log("sleeping for 2s while tests are discovered") //There's gotta be a better way to do this...
		await new Promise( resolve => setTimeout(resolve, 2000))
		const val1 = await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		console.log("ablunitJson: " + ablunitJson.fsPath)
		await vscode.workspace.fs.stat(ablunitJson).then((stat) => {
			assert(stat.type === vscode.FileType.File)
		}, (err) => {
			console.log("ablunit.json file does not exist (" + ablunitJson.fsPath + "): " + err)
			assert.fail("ablunit.json file does not exist: " + err)
		})
	});

	test('wrap up', () => {
		assert.equal(1,1);
	})

});
