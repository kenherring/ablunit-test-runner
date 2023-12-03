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
			await getStorageUri(vscode.workspace.workspaceFolders![0]),
			await getStorageUri(vscode.workspace.workspaceFolders![1])
		]
		if (!storageUri[0] || !storageUri[1]) {
			assert.fail("storage uri not defined")
		}

		console.log("validate proj0 success")
		let ablunitJson = vscode.Uri.joinPath(storageUri[0],'ablunit.json')
		let resultsXml = vscode.Uri.joinPath(storageUri[0],'results.xml')
		let resultsJson = vscode.Uri.joinPath(storageUri[0],'results.json')
		let listingsDir = vscode.Uri.joinPath(storageUri[0],'listings')
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
		assert(!await doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")

		console.log("validate proj3 success")
		ablunitJson = vscode.Uri.joinPath(storageUri[1],'ablunit.json')
		resultsXml = vscode.Uri.joinPath(storageUri[1],'results.xml')
		resultsJson = vscode.Uri.joinPath(storageUri[1],'results.json')
		listingsDir = vscode.Uri.joinPath(storageUri[1],'listings')
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
		assert(!await doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")

		console.log("validate projX has no ablunit.json")
		ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![2].uri,'ablunit.json')
		assert(!await doesFileExist(ablunitJson), "ablunit.json exists and should not (" + ablunitJson.fsPath + ")")
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
