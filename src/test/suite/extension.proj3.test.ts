import * as assert from 'assert';
import { after, before } from 'mocha';
import * as vscode from 'vscode';

before(async () => {
    console.log("before")
});

after(() => {
	console.log("after")
});

suite('Extension Test Suite - proj3', () => {

	test('target/ablunit.json file exists', async () => {
		const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'target','ablunit.json')
		await vscode.commands.executeCommand('testing.refreshTests');
		await vscode.commands.executeCommand('workbench.view.testing.focus')
		console.log("sleeping for 2s while tests are discovered") //There's gotta be a better way to do this...
		await new Promise( resolve => setTimeout(resolve, 2000))
		const val1 = await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		await vscode.workspace.fs.stat(ablunitJson).then((stat) => {
			assert(stat.type === vscode.FileType.File)
		}, (err) => {
			assert.fail("ablunit.json file does not exist: " + err)
		})
	});

	test('wrap up', () => {
		assert.equal(1,1);
	})

});
