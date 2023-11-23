import * as assert from 'assert';
import { afterEach, beforeEach } from 'mocha';
import * as vscode from 'vscode';
import { doesFileExist, getTestCount } from '../common'

const projName = 'proj1'

beforeEach(async () => {
    console.log("beforeEach")
	await vscode.workspace.getConfiguration('ablunit').update('files.exclude', undefined)
})

afterEach(async () => {
	console.log("afterEach")
	await vscode.workspace.getConfiguration('ablunit').update('files.exclude', undefined)
})

suite('Extension Test Suite - ' + projName, () => {

	test('output files exist - 1', async () => {
		const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'ablunit.json')
		const resultsXml = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'results.xml')
		const resultsJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'results.json')

		await vscode.commands.executeCommand('testing.refreshTests');
		await vscode.commands.executeCommand('workbench.view.testing.focus')

		console.log("sleeping for 2s while tests are discovered") //There's gotta be a better way to do this...
		await new Promise( resolve => setTimeout(resolve, 2000))

		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		console.log("ablunitJson: " + ablunitJson.fsPath)
		assert(await doesFileExist(ablunitJson),"ablunit.json exists")
		console.log("resultsXml: " + resultsXml.fsPath)
		assert(await doesFileExist(resultsXml),"results.xml exists")
		console.log("resultsJson: " + resultsJson.fsPath)
		assert(!await doesFileExist(resultsJson),"results.json does not exist")
	});

	test('output files exist 2 - exclude compileError.p', async () => {
		await vscode.workspace.getConfiguration('ablunit').update('files.exclude', ['.builder/**','compileError.p'])
		await vscode.commands.executeCommand('testing.refreshTests')

		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		const resultsJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'results.json')
		const testCount = await getTestCount(resultsJson)
		console.log("getTestCount: " + testCount)
		assert.equal(10,testCount)
	});

});
