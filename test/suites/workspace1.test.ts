import { Uri, workspace } from 'vscode'
import { assert, log, runAllTests, suiteSetupCommon, updateTestProfile } from '../testCommon'

suite('workspace1 - Extension Test Suite', () => {

	suiteSetup('proj2 - before', () => suiteSetupCommon())

	teardown('workspace1 - afterEach', () => {
		return updateTestProfile('tempDir', undefined)
	})

	test('workspace1.1 - <workspaceFolder>/ablunit.json file exists', async () => {
		await runAllTests()

		const workspaceFolderUri = [
			workspace.workspaceFolders![0].uri,
			Uri.joinPath(workspace.workspaceFolders?.[1].uri ?? Uri.parse(__dirname), 'target'),
			workspace.workspaceFolders![2].uri,
		]
		if (!workspaceFolderUri[0] || !workspaceFolderUri[1] || !workspaceFolderUri[2]) {
			assert.fail('storage uri not defined')
			return
		}

		log.info('___ validate proj0 ___ [' + workspaceFolderUri[0] + ']')
		let ablunitJson = Uri.joinPath(workspaceFolderUri[0], 'ablunit.json')
		let resultsXml = Uri.joinPath(workspaceFolderUri[0], 'results.xml')
		let resultsJson = Uri.joinPath(workspaceFolderUri[0], 'results.json')
		let listingsDir = Uri.joinPath(workspaceFolderUri[0], 'listings')
		assert.fileExists(ablunitJson)
		assert.fileExists(resultsXml)
		assert.notFileExists(resultsJson)
		assert.notDirExists(listingsDir)

		log.info('___ validate proj3 ___ [' + workspaceFolderUri[1] + ']')
		ablunitJson = Uri.joinPath(workspaceFolderUri[1], 'ablunit.json')
		resultsXml = Uri.joinPath(workspaceFolderUri[1], '..', 'ablunit-output', 'results.xml')
		resultsJson = Uri.joinPath(workspaceFolderUri[1], '..', 'ablunit-output', 'results.json')
		listingsDir = Uri.joinPath(workspaceFolderUri[1], 'listings')
		assert.fileExists(ablunitJson)
		assert.fileExists(resultsXml)
		assert.notFileExists(resultsJson)
		// assert.notDirExists(listingsDir)

		log.info('___ validate projX has no ablunit.json ___ [' + workspaceFolderUri[2] + ']')
		ablunitJson = Uri.joinPath(workspaceFolderUri[2], 'ablunit.json')
		assert.notFileExists(ablunitJson)
	})

	test.skip('workspace1.2 - <storageUri>/ablunit.json file exists', () => {
		return updateTestProfile('tempDir', 'workspaceAblunit')
			.then(() => { return runAllTests() })
			.then(() => {
				for (let i = 0; i < 2; i++) {
					log.info('___ validate folder #' + i + ' success [' + workspace.workspaceFolders![i].name + '] ___')
					const ablunitJson = Uri.joinPath(workspace.workspaceFolders![i].uri, 'workspaceAblunit', 'ablunit.json')
					const resultsXml = Uri.joinPath(workspace.workspaceFolders![i].uri, 'workspaceAblunit', 'results.xml')
					const resultsJson = Uri.joinPath(workspace.workspaceFolders![i].uri, 'workspaceAblunit', 'results.json')
					const listingsDir = Uri.joinPath(workspace.workspaceFolders![i].uri, 'workspaceAblunit', 'listings')

					assert.fileExists(ablunitJson)
					assert.fileExists(resultsXml)
					assert.notFileExists(resultsJson)
					assert.notDirExists(listingsDir)
				}
				return
			}, (e) => { throw e })
	})

})
