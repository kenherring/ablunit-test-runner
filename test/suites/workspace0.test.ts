import { strict as assert } from 'assert'
import { Uri } from 'vscode'
import { doesDirExist, doesFileExist, getWorkspaceFolders, runAllTests, suiteSetupCommon } from '../testCommon'

suite('workspace0 - Extension Test Suite', () => {

	suiteSetup('workspace0 - before', async () => {
		await suiteSetupCommon()
	})

	test('workspace0.1 - <workspaceFolder>/ablunit.json file exists', async () => {
		await runAllTests()

		const workspaceFolder = getWorkspaceFolders()[0].uri

		const ablunitJson = Uri.joinPath(workspaceFolder, 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceFolder, 'results.xml')
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')
		const listingsDir = Uri.joinPath(workspaceFolder, 'listings')

		assert(doesFileExist(ablunitJson), 'missing ablunit.json (' + ablunitJson.fsPath + ')')
		assert(doesFileExist(resultsXml), 'missing results.xml (' + resultsXml.fsPath + ')')
		assert(!doesFileExist(resultsJson), 'results.json exists and should not (' + resultsJson.fsPath + ')')
		assert(!doesDirExist(listingsDir), 'listings dir exists and should not (' + listingsDir.fsPath + ')')
	})

})
