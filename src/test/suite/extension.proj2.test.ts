import * as assert from 'assert';
import { after, beforeEach } from 'mocha';
import * as vscode from 'vscode';

suite('Extension Test Suite - proj2', () => {

	after(() => {
		console.log("after")
	});

	test('temp/ablunit.json file exists', async () => {
		const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'temp','ablunit.json')
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