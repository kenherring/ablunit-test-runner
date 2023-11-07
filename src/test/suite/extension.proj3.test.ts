import * as assert from 'assert';
import { after } from 'mocha';
import * as vscode from 'vscode';

suite('Extension Test Suite - proj3', () => {

	after(() => {
		console.log("after")
	});

	test('target/ablunit.json file exists', async () => {
		const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'target','ablunit.json')
		await vscode.commands.executeCommand('workbench.view.testing.focus').then(async () => {
			return
		})
		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		}, (err) => {
			assert.fail("testing.runAll failed: " + err)
		})
		const val = await vscode.workspace.fs.stat(ablunitJson).then((stat) => { return stat.type === vscode.FileType.File }, (err) => { return false })
		console.log("val=" + val)
		assert.equal(val,true)
	})
});
