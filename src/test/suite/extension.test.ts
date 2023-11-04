import * as assert from 'assert';
import { after } from 'mocha';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {

	after(() => {
		console.log("after")
	});

	test('Sample test', () => {
		console.log("test1")
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	// test('ablunit.json file exists 1', async () => {
	// 	console.log("test2")
	// 	const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'ablunit.json')
	// 	await vscode.commands.executeCommand('workbench.view.testing.focus').then(async () => {
	// 		return
	// 	})
	// 	await vscode.commands.executeCommand('testing.runAll').then(() => {
	// 		console.log("testing.runAll complete!")
	// 	}, (err) => {
	// 		assert.fail("testing.runAll failed: " + err)
	// 	})
	// 	const val = await vscode.workspace.fs.stat(ablunitJson).then((stat) => { return stat.type === vscode.FileType.File }, (err) => { return false })
	// 	console.log("val=" + val)
	// 	assert.equal(val,true)
	// })
});
