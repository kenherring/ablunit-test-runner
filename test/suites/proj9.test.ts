import { assert, deleteFile, deleteTestFiles, getTestCount, getWorkspaceUri, log, runAllTests, selectProfile, suiteSetupCommon, updateTestProfile, Uri, workspace } from '../testCommon'

const testProfileJson = Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json')
const testProfileBackup = Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json.backup')

suite('proj9 - Extension Test Suite', () => {

	suiteSetup('proj9 - before', async () => {
		await suiteSetupCommon()
			.then(() => { return workspace.fs.copy(testProfileJson, testProfileBackup, { overwrite: true }) })
			.then(() => { return }, (e) => { throw e })
	})

	setup('proj9 - beforeEach', () => {
		const workspaceFolder = workspace.workspaceFolders![0].uri
		deleteFile(Uri.joinPath(workspaceFolder, '.vscode', 'profile.json'))
		deleteTestFiles()
		return
	})

	teardown('proj9 - afterEach', async () => {
		deleteFile(testProfileJson)
		await workspace.fs.copy(testProfileBackup, testProfileJson, { overwrite: true })
		// await workspace.fs.copy(testProfileBackup, testProfileJson, { overwrite: true }).then(() => {
		// 	log.info('teardown return')
		// 	return
		// }, (e) => {
		// 	log.error('teardown error: e=' + e)
		// 	throw e
		// })
	})

	suiteTeardown('proj9 - after', () => {
		return workspace.fs.delete(testProfileBackup)
		// await workspace.fs.delete(testProfileBackup).then(() => {
		// 	log.info('suiteTeardown return')
		// 	return
		// }, (e) => {
		// 	log.error('suiteTeardown error: e=' + e)
		// 	throw e
		// })
	})

	test('proj9.1 - ${workspaceFolder}/ablunit.json file exists', async () => {
		await runAllTests()
		const workspaceFolder = workspace.workspaceFolders![0].uri
		const ablunitJson = Uri.joinPath(workspaceFolder, 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceFolder, 'results.xml')
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(ablunitJson)
		assert.fileExists(resultsXml)
		assert.fileExists(resultsJson)

		assert.equal(await getTestCount(resultsJson, 'pass'), 7, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.2 - second profile passes (project)', async () => {
		await selectProfile('profile2')
		await runAllTests(false)

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		await selectProfile('profile2')
			.then(() => { return runAllTests() })
			.then(() => { assert.fileExists(resultsJson) })
		assert.equal(await getTestCount(resultsJson, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.3 - third profile passes (inherits propath from 2)', async () => {
		// const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJsonUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'results.json')

		await selectProfile('profile3')
		await runAllTests(false)

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.4 - run default profile, then profile 3', async () => {
		await selectProfile('default')
		await runAllTests(false)
		await selectProfile('profile3')
		await runAllTests(false)

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.12 - second profile passes (config)', async () => {
		await updateTestProfile('openedgeProjectProfile', 'profile2')
			.then(() => { return runAllTests() })

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.20 - do not import openedge-project.json', async () => {
		await updateTestProfile('importOpenedgeProjectJson', false)
		await updateTestProfile('openedgeProjectProfile', 'profile2')

		await runAllTests(false).catch((e: unknown) => {
			log.info('runAllTests failed, as expected: e=' + e)
		})
		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')
		assert.notFileExists(resultsJson)
	})

})
