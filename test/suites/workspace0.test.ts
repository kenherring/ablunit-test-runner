import { Uri } from 'vscode'
import { assert, doesDirExist, doesFileExist, getWorkspaceFolders, runAllTests, suiteSetupCommon } from '../testCommon'

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

		assert.fileExists(ablunitJson)
		assert.fileExists(resultsXml)
		assert.ok(!doesFileExist(resultsJson), 'results.json exists and should not (' + resultsJson.fsPath + ')')
		assert.ok(!doesDirExist(listingsDir), 'listings dir exists and should not (' + listingsDir.fsPath + ')')
	})

})
