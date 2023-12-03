import * as assert from 'assert'
import { Uri, workspace } from 'vscode'
import { after, before } from 'mocha'
import { getStorageUri } from '../../extension'
import { doesDirExist, doesFileExist, runAllTests } from '../common'


const projName = 'workspace1'

before(async () => {
    console.log("before")
	await workspace.getConfiguration('ablunit').update('tempDir', undefined)
})

after(async () => {
	console.log("after")
	await workspace.getConfiguration('ablunit').update('tempDir', undefined)
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - <storageUri>/ablunit.json file exists', async () => {
		await runAllTests()

		const storageUri = [
			await getStorageUri(workspace.workspaceFolders![0]),
			await getStorageUri(workspace.workspaceFolders![1])
		]
		if (!storageUri[0] || !storageUri[1]) {
			assert.fail("storage uri not defined")
		}

		console.log("validate proj0 success")
		let ablunitJson = Uri.joinPath(storageUri[0],'ablunit.json')
		let resultsXml = Uri.joinPath(storageUri[0],'results.xml')
		let resultsJson = Uri.joinPath(storageUri[0],'results.json')
		let listingsDir = Uri.joinPath(storageUri[0],'listings')
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
		assert(!await doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")

		console.log("validate proj3 success")
		ablunitJson = Uri.joinPath(storageUri[1],'ablunit.json')
		resultsXml = Uri.joinPath(storageUri[1],'results.xml')
		resultsJson = Uri.joinPath(storageUri[1],'results.json')
		listingsDir = Uri.joinPath(storageUri[1],'listings')
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
		assert(!await doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")

		console.log("validate projX has no ablunit.json")
		ablunitJson = Uri.joinPath(workspace.workspaceFolders![2].uri,'ablunit.json')
		assert(!await doesFileExist(ablunitJson), "ablunit.json exists and should not (" + ablunitJson.fsPath + ")")
	})

	test(projName + '.2 - <storageUri>/ablunit.json file exists', async () => {
		await workspace.getConfiguration('ablunit').update('tempDir', 'workspaceAblunit')
		await runAllTests()

		for (let i = 0; i < 2; i++) {
			console.log("validate proj0 success")
			const ablunitJson = Uri.joinPath(workspace.workspaceFolders![i].uri,'workspaceAblunit','ablunit.json')
			const resultsXml = Uri.joinPath(workspace.workspaceFolders![i].uri,'workspaceAblunit','results.xml')
			const resultsJson = Uri.joinPath(workspace.workspaceFolders![i].uri,'workspaceAblunit','results.json')
			const listingsDir = Uri.joinPath(workspace.workspaceFolders![i].uri,'workspaceAblunit','listings')

			assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
			assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
			assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
			assert(!await doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")
		}
	})

})
