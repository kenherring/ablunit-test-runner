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

	test('ablunit.json file exists', () => {
		vscode.commands.executeCommand('testing.runAll').then(() => {
			const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'target/ablunit2.json')
			console.log("ablunitJson: " + ablunitJson.fsPath)
			assert.equal(doesFileExist(ablunitJson),true)
		})
	})

})

async function doesFileExist (uri: vscode.Uri) {
	const val = await vscode.workspace.fs.stat(uri).then((stat) => { return stat.type === vscode.FileType.File }, (err) => { return false })
	console.log("val=" + val)
	return val
}
