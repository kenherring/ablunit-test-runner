import * as assert from 'assert'
import { after, before, beforeEach } from 'mocha'
import { Uri, workspace } from 'vscode'
import { getStorageUri } from '../../extension'
import { doesDirExist, doesFileExist, runAllTests, updateConfig, waitForExtensionActive } from '../testCommon'


const projName = 'workspace1'

before(async () => {
	await waitForExtensionActive()
})

beforeEach(async () => {
    console.log("before")
	await updateConfig("tempDir", undefined)
})

after(async () => {
	console.log("after")
	await updateConfig("tempDir", undefined)
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - <storageUri>/ablunit.json file exists', async () => {
		await runAllTests()

		const storageUri = [
			await getStorageUri(workspace.workspaceFolders![0]),
			await getStorageUri(workspace.workspaceFolders![1]),
			await getStorageUri(workspace.workspaceFolders![2])
		]
		if (!storageUri[0] || !storageUri[1]) {
			assert.fail("storage uri not defined")
		}

		console.log("___ validate proj0 ___ [" + storageUri[0] + "]")
		let ablunitJson = Uri.joinPath(storageUri[0],'ablunit.json')
		let resultsXml = Uri.joinPath(storageUri[0],'results.xml')
		let resultsJson = Uri.joinPath(storageUri[0],'results.json')
		let listingsDir = Uri.joinPath(storageUri[0],'listings')
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
		assert(!await doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")

		console.log("___ validate proj3 ___ [" + storageUri[1] + "]")
		ablunitJson = Uri.joinPath(storageUri[1],'ablunit.json')
		resultsXml = Uri.joinPath(storageUri[1],'results.xml')
		resultsJson = Uri.joinPath(storageUri[1],'results.json')
		listingsDir = Uri.joinPath(storageUri[1],'listings')
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
		assert(!await doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")

		console.log("___ validate projX has no ablunit.json ___ [" + storageUri[2] + "]")
		ablunitJson = Uri.joinPath(storageUri[2],'ablunit.json')
		assert(!await doesFileExist(ablunitJson), "ablunit.json exists and should not (" + ablunitJson.fsPath + ")")
	})

	test(projName + '.2 - <storageUri>/ablunit.json file exists', async () => {
		await updateConfig("tempDir", "workspaceAblunit")
		await runAllTests()

		for (let i = 0; i < 2; i++) {
			console.log("___ validate folder #" + i + " success [" + workspace.workspaceFolders![i].name + "] ___")
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
