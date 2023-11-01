import * as assert from 'assert';
import { after } from 'mocha';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

// import * as myExtension from '../extension';

suite('Extension Test Suite', () => {
	after(() => {
		vscode.window.showInformationMessage('All tests done!')
		console.log("DONE after!")
		vscode.commands.executeCommand('workbench.action.closeWindow')
	});

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5))
		assert.strictEqual(-1, [1, 2, 3].indexOf(0))
	});

	test('ablunit.json file exists 1', async () => {
		const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'ablunit.json')
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

	// test('ablunit.json file exists 2', async () => {
	// 	console.log(10)
	// 	console.log("20: " + vscode.workspace.workspaceFolders![0].uri.fsPath)
	// 	const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'ablunit.json')
	// 	const val = true
	// 	assert.equal(val,true)
	// 	console.log("done 3")
	// })
})
