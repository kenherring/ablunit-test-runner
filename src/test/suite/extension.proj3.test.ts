import * as assert from 'assert';
import { after, before } from 'mocha';
import * as vscode from 'vscode';


before(async () => {
    return console.log("before")
});

after(() => {
	console.log("after")
});

suite('Extension Test Suite - proj3', () => {

	test('target/ablunit.json file exists', async () => {
		console.log("test1")

		const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'target','ablunit.json')
		console.log("test2")
		await vscode.commands.executeCommand('testing.refreshTests');
		const val2 = await vscode.commands.executeCommand('workbench.view.testing.focus')
		console.log("test3")
		const val1 = await vscode.commands.executeCommand('testing.runAll')
		// const val1 = await vscode.commands.executeCommand('testing.runAll').then(() => {
		// 	console.log("test4")
		// 	console.log("testing.runAll complete!")
		// 	console.log("test5")
		// }, (err) => {
		// 	console.log("test6")
		// 	assert.fail("testing.runAll failed: " + err)
		// })
		console.log("test7")
		const val = await vscode.workspace.fs.stat(ablunitJson).then((stat) => {
			return true
		}, (err) => {
			console.log("stat err=" + err)
			return false
		})
		// expect(val).equal(true)
		console.log("test8")
		console.log("val=" + val)
		console.log("test9")
		assert.equal(val,true)
		console.log("test10")
	});

	test('wrap up', () => {
		assert.equal(1,1);
	})
});
