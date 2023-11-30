import * as assert from 'assert';
import { afterEach, beforeEach } from 'mocha';
import * as vscode from 'vscode';
import { doesFileExist, getTestCount, sleep } from '../common'

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

		await sleep(2000)

		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		assert(await doesFileExist(ablunitJson),"missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml),"missing results.xml (" + resultsXml.fsPath + ")")
		assert(await doesFileExist(resultsJson),"missing results.json (" + resultsJson.fsPath + ")")
	})

	test('output files exist 2 - exclude compileError.p', async () => {
		await vscode.workspace.getConfiguration('ablunit').update('files.exclude', [ ".builder/**", "compileError.p" ])
		sleep(500)

		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		const resultsJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'results.json')
		const testCount = await getTestCount(resultsJson)
		console.log("getTestCount: " + testCount)
		assert.equal(10,testCount)
	})

})
