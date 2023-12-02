import * as assert from 'assert';
import { after, before } from 'mocha';
import * as vscode from 'vscode';
import { getStorageUri } from '../../extension'
import { doesDirExist, doesFileExist, runAllTests } from '../common'


const projName = 'workspace1'

before(async () => {
    console.log("before")
	await vscode.workspace.getConfiguration('ablunit').update('tempDir', undefined)
})

after(async () => {
	console.log("after")
	await vscode.workspace.getConfiguration('ablunit').update('tempDir', undefined)
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - <storageUri>/ablunit.json file exists', async () => {
		await runAllTests()

		const storageUri = [
			getStorageUri(vscode.workspace.workspaceFolders![0]),
			getStorageUri(vscode.workspace.workspaceFolders![1])
		]
		if (!storageUri[0] || !storageUri[1]) {
			assert.fail("storage uri not defined")
		}

		console.log("validate proj0 success")
		const ablunitJson = vscode.Uri.joinPath(storageUri[0],'ablunit.json')
		const resultsXml = vscode.Uri.joinPath(storageUri[0],'results.xml')
		const resultsJson = vscode.Uri.joinPath(storageUri[0],'results.json')
		const listingsDir = vscode.Uri.joinPath(storageUri[0],'listings')

		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
		assert(!await doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")

		console.log("validate proj3 success")
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
		assert(!await doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")
	})

	test(projName + '.2 - <storageUri>/ablunit.json file exists', async () => {
		await vscode.workspace.getConfiguration('ablunit').update('tempDir', 'workspaceAblunit')
		await runAllTests()

		for (let i = 0; i < 2; i++) {
			console.log("validate proj0 success")
			const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![i].uri,'workspaceAblunit','ablunit.json')
			const resultsXml = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![i].uri,'workspaceAblunit','results.xml')
			const resultsJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![i].uri,'workspaceAblunit','results.json')
			const listingsDir = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![i].uri,'workspaceAblunit','listings')

			assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
			assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
			assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
			assert(!await doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")
		}
	})

})
