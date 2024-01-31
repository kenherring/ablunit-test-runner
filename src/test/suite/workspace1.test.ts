import { strict as assert } from 'assert'
import { after, before, beforeEach } from 'mocha'
import { Uri, workspace } from 'vscode'
import { doesDirExist, doesFileExist, runAllTests, updateConfig, waitForExtensionActive } from '../testCommon'


const projName = 'workspace1'

before(async () => {
	await waitForExtensionActive()
})

beforeEach(async () => {
	console.log('before')
	await updateConfig('tempDir', undefined)
})

after(async () => {
	console.log('after')
	await updateConfig('tempDir', undefined)
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - <workspaceFolder>/ablunit.json file exists', async () => {
		await runAllTests()

		const workspaceFolderUri = [
			workspace.workspaceFolders![0].uri,
			Uri.joinPath(workspace.workspaceFolders![1].uri,'target'),
			workspace.workspaceFolders![2].uri,
		]
		if (!workspaceFolderUri[0] || !workspaceFolderUri[1] || !workspaceFolderUri[2]) {
			assert.fail('storage uri not defined')
		}

		console.log('___ validate proj0 ___ [' + workspaceFolderUri[0] + ']')
		let ablunitJson = Uri.joinPath(workspaceFolderUri[0],'ablunit.json')
		let resultsXml = Uri.joinPath(workspaceFolderUri[0],'results.xml')
		let resultsJson = Uri.joinPath(workspaceFolderUri[0],'results.json')
		let listingsDir = Uri.joinPath(workspaceFolderUri[0],'listings')
		assert(doesFileExist(ablunitJson), 'missing ablunit.json (' + ablunitJson.fsPath + ')')
		assert(doesFileExist(resultsXml), 'missing results.xml (' + resultsXml.fsPath + ')')
		assert(!doesFileExist(resultsJson), 'results.json exists and should not (' + resultsJson.fsPath + ')')
		assert(!doesDirExist(listingsDir), 'listings dir exists and should not (' + listingsDir.fsPath + ')')

		console.log('___ validate proj3 ___ [' + workspaceFolderUri[1] + ']')
		ablunitJson = Uri.joinPath(workspaceFolderUri[1],'ablunit.json')
		resultsXml = Uri.joinPath(workspaceFolderUri[1],'..','ablunit-output', 'results.xml')
		resultsJson = Uri.joinPath(workspaceFolderUri[1],'..', 'ablunit-output', 'results.json')
		listingsDir = Uri.joinPath(workspaceFolderUri[1],'listings')
		assert(doesFileExist(ablunitJson), 'missing ablunit.json (' + ablunitJson.fsPath + ')')
		assert(doesFileExist(resultsXml), 'missing results.xml (' + resultsXml.fsPath + ')')
		assert(!doesFileExist(resultsJson), 'results.json exists and should not (' + resultsJson.fsPath + ')')
		assert(doesDirExist(listingsDir), 'listings dir exists and should not (' + listingsDir.fsPath + ')')

		console.log('___ validate projX has no ablunit.json ___ [' + workspaceFolderUri[2] + ']')
		ablunitJson = Uri.joinPath(workspaceFolderUri[2],'ablunit.json')
		assert(!doesFileExist(ablunitJson), 'ablunit.json exists and should not (' + ablunitJson.fsPath + ')')
	})

	// test(projName + '.2 - <storageUri>/ablunit.json file exists', async () => {
	// 	await updateConfig("tempDir", "workspaceAblunit")
	// 	await runAllTests()

	// 	for (let i = 0; i < 2; i++) {
	// 		console.log("___ validate folder #" + i + " success [" + workspace.workspaceFolders![i].name + "] ___")
	// 		const ablunitJson = Uri.joinPath(workspace.workspaceFolders![i].uri,'workspaceAblunit','ablunit.json')
	// 		const resultsXml = Uri.joinPath(workspace.workspaceFolders![i].uri,'workspaceAblunit','results.xml')
	// 		const resultsJson = Uri.joinPath(workspace.workspaceFolders![i].uri,'workspaceAblunit','results.json')
	// 		const listingsDir = Uri.joinPath(workspace.workspaceFolders![i].uri,'workspaceAblunit','listings')

	// 		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
	// 		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
	// 		assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
	// 		assert(!await doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")
	// 	}
	// })

})
