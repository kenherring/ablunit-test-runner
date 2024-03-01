import { Uri, assert, doesDirExist, doesFileExist, log, runAllTests, suiteSetupCommon, workspace } from '../testCommon'

suite('workspace0Suite', () => {

	suiteSetup('workspace0 - suiteSetup', suiteSetupCommon)

	test('workspace0.1 - <workspaceFolder>/ablunit.json file exists', async () => {
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		log.info('workspaceFolder=' + workspaceFolder.fsPath)

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
