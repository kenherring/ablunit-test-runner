import { Uri, workspace } from 'vscode'
import { assert, getWorkspaceUri, log, runAllTests, suiteSetupCommon, updateTestProfile } from '../testCommon'

suite('workspace1 - Extension Test Suite', () => {

	suiteSetup('workspace1 - before', async () => {
		await suiteSetupCommon()

		const files = [
			Uri.joinPath(getWorkspaceUri(0), '.vscode', 'ablunit-test-profile.json'),
			Uri.joinPath(getWorkspaceUri(0), 'listings'),
			Uri.joinPath(getWorkspaceUri(1), 'listings'),
			Uri.joinPath(getWorkspaceUri(0), 'workspaceAblunit'),
			Uri.joinPath(getWorkspaceUri(1), 'workspaceAblunit'),
		]
		for (const f of files) {
			log.info('deleting ' + f.fsPath)
			await workspace.fs.delete(f, { recursive: true })
				.then(() => {
					log.info('deleted ' + f.fsPath)
					return
				}, () => {
					log.info('cannot delete ' + f.fsPath + ', does not exist')
				})
		}

		await workspace.fs.copy(Uri.joinPath(getWorkspaceUri(1), '.vscode', 'ablunit-test-profile.json'), Uri.joinPath(getWorkspaceUri(1), '.vscode', 'ablunit-test-profile.json.bk'), { overwrite: true })
	})

	teardown('workspace1 - afterEach', async () => {
		log.info('after')
		await workspace.fs.delete(Uri.joinPath(getWorkspaceUri(0), '.vscode', 'ablunit-test-profile.json')).then(() => { return }, (e) => { return })
		await workspace.fs.copy(Uri.joinPath(getWorkspaceUri(1), '.vscode', 'ablunit-test-profile.json.bk'), Uri.joinPath(getWorkspaceUri(1), '.vscode', 'ablunit-test-profile.json'), { overwrite: true })
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

		log.info('___ validate proj0 ___ [' + workspaceFolderUri[0].fsPath + ']')
		let ablunitJson = Uri.joinPath(workspaceFolderUri[0], 'ablunit.json')
		let resultsXml = Uri.joinPath(workspaceFolderUri[0], 'results.xml')
		let resultsJson = Uri.joinPath(workspaceFolderUri[0], 'results.json')
		let listingsDir = Uri.joinPath(workspaceFolderUri[0], 'listings')
		assert.fileExists(ablunitJson)
		assert.fileExists(resultsXml)
		assert.notFileExists(resultsJson)
		assert.notDirExists(listingsDir)

		log.info('___ validate proj3 ___ [' + workspaceFolderUri[1].fsPath + ']')
		ablunitJson = Uri.joinPath(workspaceFolderUri[1], 'ablunit.json')
		resultsXml = Uri.joinPath(workspaceFolderUri[1], '..', 'ablunit-output', 'results.xml')
		resultsJson = Uri.joinPath(workspaceFolderUri[1], '..', 'ablunit-output', 'results.json')
		listingsDir = Uri.joinPath(workspaceFolderUri[1], 'listings')
		assert.fileExists(ablunitJson)
		assert.fileExists(resultsXml)
		assert.notFileExists(resultsJson)
		// assert.notDirExists(listingsDir)

		log.info('___ validate projX has no ablunit.json ___ [' + workspaceFolderUri[2].fsPath + ']')
		ablunitJson = Uri.joinPath(workspaceFolderUri[2], 'ablunit.json')
		assert.notFileExists(ablunitJson)
	})

	test('workspace1.2 - ${tempDir}/ablunit.json file exists', async () => {
		await updateTestProfile('tempDir', 'workspaceAblunit', getWorkspaceUri(0))
		await updateTestProfile('tempDir', 'workspaceAblunit', getWorkspaceUri(1))
		await updateTestProfile('options.output.location', undefined, getWorkspaceUri(1))
		await runAllTests().then(() => {
			for (let i = 0; i < 2; i++) {
				log.info('___ validate folder #' + i + '; ' + workspace.workspaceFolders![i].uri.fsPath + ' ___')
				const ablunitJson = Uri.joinPath(workspace.workspaceFolders![i].uri, 'workspaceAblunit', 'ablunit.json')
				const resultsXml = Uri.joinPath(workspace.workspaceFolders![i].uri, 'workspaceAblunit', 'results.xml')
				const resultsJson = Uri.joinPath(workspace.workspaceFolders![i].uri, 'workspaceAblunit', 'results.json')

				assert.fileExists(ablunitJson)
				assert.fileExists(resultsXml)
				assert.notFileExists(resultsJson)
			}
		})
	})

})
