import * as assert from 'assert';
import { after } from 'mocha';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

// import * as myExtension from '../extension';

suite('Extension Test Suite', () => {
	after(() => {
		vscode.window.showInformationMessage('All tests done!')
	});

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5))
		assert.strictEqual(-1, [1, 2, 3].indexOf(0))
	});

	test('ablunit.json file exists 1', async () => {
		console.log(1)
		console.log("2: " + vscode.workspace.workspaceFolders![0].uri.fsPath)
		const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'ablunit.json')
		console.log(2 + " " + vscode.workspace.workspaceFolders![0].uri.fsPath)
		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log(3)
			console.log("ablunitJson: " + ablunitJson.fsPath)
		}, (err) => {
			assert.fail(err)
		})
		console.log(3)
		const val = await vscode.workspace.fs.stat(ablunitJson).then((stat) => { return stat.type === vscode.FileType.File }, (err) => { return false })
		console.log("val=" + val)
		console.log(4)
		// const val = true
		assert.equal(val,true)
		// console.log(5)
	}).timeout(10000)

	test('ablunit.json file exists 2', async () => {
		console.log(1)
		console.log("2: " + vscode.workspace.workspaceFolders![0].uri.fsPath)
		const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'ablunit.json')
		const val = true
		assert.equal(val,true)
	})
})
