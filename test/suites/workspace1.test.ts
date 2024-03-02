import { Uri, assert, deleteFile, doesDirExist, doesFileExist, log, runAllTests, suiteSetupCommon, updateConfig, workspace } from '../testCommon'

export default suite('workspace1Suite', () => {

	suiteSetup('workspace1 - suiteSetup', suiteSetupCommon)

	setup('wokspace1 - setup', async () => {
		deleteFile('.vscode/ablunit-test-profile.json')
		return updateConfig('tempDir', undefined)
	})

	teardown('workspace1 - teardown', async () => {
		deleteFile('.vscode/ablunit-test-profile.json')
		return updateConfig('tempDir', undefined)
	})

	test('workspace1.0 - <workspaceFolder>/ablunit.json file exists', () => {
		log.info('START ws-0.1')
		assert.assert('workspace1.0 - pass')
		log.info('END ws-0.1')
	})

	test('workspace1.1 - <workspaceFolder>/ablunit.json file exists', async () => {
		log.info('START 1.1')
		await runAllTests()
		log.info('workspace1.1 - runAllTests done')
		log.info('workspaceFolders.length=' + workspace.workspaceFolders?.length)
		log.info('workspaceFolders[0]=' + workspace.workspaceFolders?.[0].uri.fsPath)
		log.info('workspaceFolders[1]=' + workspace.workspaceFolders?.[1].uri.fsPath)
		log.info('workspaceFolders[2]=' + workspace.workspaceFolders?.[2].uri.fsPath)

		const workspaceFolderUri = [
			workspace.workspaceFolders![0].uri,
			Uri.joinPath(workspace.workspaceFolders![1].uri, 'target'),
			workspace.workspaceFolders![2].uri,
		]
		log.info('workspace1.1 - 100')
		if (!workspaceFolderUri[0] || !workspaceFolderUri[1] || !workspaceFolderUri[2]) {
			log.info('workspace1.1 - 101')
			assert.fail('storage uri not defined')
		}

		log.info('workspace1.1 - 110')
		log.info('___ validate proj0 ___ [' + workspaceFolderUri[0] + ']')
		let ablunitJson = Uri.joinPath(workspaceFolderUri[0], 'ablunit.json')
		let resultsXml = Uri.joinPath(workspaceFolderUri[0], 'results.xml')
		let resultsJson = Uri.joinPath(workspaceFolderUri[0], 'results.json')
		let listingsDir = Uri.joinPath(workspaceFolderUri[0], 'listings')
		log.info('workspace1.1 - 120')
		assert.assert(doesFileExist(ablunitJson), 'missing ablunit.json (' + ablunitJson.fsPath + ')')
		assert.assert(doesFileExist(resultsXml), 'missing results.xml (' + resultsXml.fsPath + ')')
		assert.assert(!doesFileExist(resultsJson), 'results.json exists and should not (' + resultsJson.fsPath + ')')
		assert.assert(!doesDirExist(listingsDir), 'listings dir exists and should not (' + listingsDir.fsPath + ')')
		log.info('workspace1.1 - 130')

		log.info('___ validate proj3 ___ [' + workspaceFolderUri[1] + ']')
		ablunitJson = Uri.joinPath(workspaceFolderUri[1], 'ablunit.json')
		resultsXml = Uri.joinPath(workspaceFolderUri[1], '..', 'ablunit-output', 'results.xml')
		resultsJson = Uri.joinPath(workspaceFolderUri[1], '..', 'ablunit-output', 'results.json')
		listingsDir = Uri.joinPath(workspaceFolderUri[1], 'listings')
		log.info('workspace1.1 - 140')
		assert.assert(doesFileExist(ablunitJson), 'missing ablunit.json (' + ablunitJson.fsPath + ')')
		assert.assert(doesFileExist(resultsXml), 'missing results.xml (' + resultsXml.fsPath + ')')
		assert.assert(!doesFileExist(resultsJson), 'results.json exists and should not (' + resultsJson.fsPath + ')')
		assert.assert(doesDirExist(listingsDir), 'listings dir exists and should not (' + listingsDir.fsPath + ')')
		log.info('workspace1.1 - 150')

		log.info('___ validate projX has no ablunit.json ___ [' + workspaceFolderUri[2] + ']')
		ablunitJson = Uri.joinPath(workspaceFolderUri[2], 'ablunit.json')
		log.info('workspace1.1 - 160')
		assert.assert(!doesFileExist(ablunitJson), 'ablunit.json exists and should not (' + ablunitJson.fsPath + ')')
		log.info('workspace1.1 - 170')
	})

	test('workspace1.2 - log.info only', () => { log.info('START 1.1') })

	test('workspace1.3 - <storageUri>/ablunit.json file exists', async () => {
		await updateConfig('tempDir', 'workspaceAblunit')
		await runAllTests()

		for (let i = 0; i < 2; i++) {
			log.info('___ validate folder #' + i + ' success [' + workspace.workspaceFolders![i].name + '] ___')
			const ablunitJson = Uri.joinPath(workspace.workspaceFolders![i].uri, 'workspaceAblunit', 'ablunit.json')
			const resultsXml = Uri.joinPath(workspace.workspaceFolders![i].uri, 'workspaceAblunit', 'results.xml')
			const resultsJson = Uri.joinPath(workspace.workspaceFolders![i].uri, 'workspaceAblunit', 'results.json')
			const listingsDir = Uri.joinPath(workspace.workspaceFolders![i].uri, 'workspaceAblunit', 'listings')

			assert.assert(doesFileExist(ablunitJson), 'missing ablunit.json (' + ablunitJson.fsPath + ')')
			assert.assert(doesFileExist(resultsXml), 'missing results.xml (' + resultsXml.fsPath + ')')
			assert.assert(!doesFileExist(resultsJson), 'results.json exists and should not (' + resultsJson.fsPath + ')')
			assert.assert(!doesDirExist(listingsDir), 'listings dir exists and should not (' + listingsDir.fsPath + ')')
		}
	})

})
