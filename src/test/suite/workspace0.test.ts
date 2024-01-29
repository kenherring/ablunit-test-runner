import { strict as assert } from 'assert'
import { before } from 'mocha'
import { Uri, workspace } from 'vscode'
import { doesDirExist, doesFileExist, getResults, log, runAllTests, waitForExtensionActive } from '../testCommon'


const projName = 'workspace0'

before(async () => {
	await waitForExtensionActive()
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - <workspaceFolder>/ablunit.json file exists', async () => {
		await runAllTests()

		log.info("100")
		const res = getResults()

		const workspaceFolder = workspace.workspaceFolders![0].uri

		const ablunitJson = Uri.joinPath(workspaceFolder,'ablunit.json')
		log.info('ablunit.json=' + res[0].cfg.ablunitConfig.config_uri.fsPath)
		log.info('             ' + ablunitJson.fsPath)
		const resultsXml = Uri.joinPath(workspaceFolder,'results.xml')
		const resultsJson = Uri.joinPath(workspaceFolder,'results.json')
		const listingsDir = Uri.joinPath(workspaceFolder,'listings')

		assert(doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(!doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
		assert(!doesDirExist(listingsDir), "listings dir exists and should not (" + listingsDir.fsPath + ")")
	})

})
