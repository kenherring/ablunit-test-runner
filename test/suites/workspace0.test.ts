import { assert, doesDirExist, doesFileExist, getWorkspaceFolders, runAllTests, sleep2, log, suiteSetupCommon, getResults, Uri } from '../testCommon'

suite('workspace0Suite', () => {

	suiteSetup('workspace0 - suiteSetup', suiteSetupCommon)

	test('workspace0.1 - <workspaceFolder>/ablunit.json file exists', async () => {
		await runAllTests()

		const workspaceFolder = getWorkspaceFolders()[0].uri

		const ablunitJson = Uri.joinPath(workspaceFolder, 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceFolder, 'results.xml')
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')
		const listingsDir = Uri.joinPath(workspaceFolder, 'listings')

		assert.assert(doesFileExist(ablunitJson), 'missing ablunit.json (' + ablunitJson.fsPath + ')')
		assert.assert(doesFileExist(resultsXml), 'missing results.xml (' + resultsXml.fsPath + ')')
		assert.assert(!doesFileExist(resultsJson), 'results.json exists and should not (' + resultsJson.fsPath + ')')
		assert.assert(!doesDirExist(listingsDir), 'listings dir exists and should not (' + listingsDir.fsPath + ')')
	})

})
