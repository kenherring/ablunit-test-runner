import { Uri, workspace } from 'vscode'
import { assert, deleteFile, deleteTestFiles, getTestCount, getWorkspaceUri, log, runAllTests, selectProfile, suiteSetupCommon, updateTestProfile } from '../testCommon'

const testProfileJson = Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json')
const testProfileBackup = Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json.backup')

suite('proj9 - Extension Test Suite', () => {

	suiteSetup('proj9 - before', async () => {
		await suiteSetupCommon()
		await workspace.fs.copy(testProfileJson, testProfileBackup, { overwrite: true }).then()
	})

	setup('proj9 - beforeEach', () => {
		const workspaceFolder = workspace.workspaceFolders![0].uri
		deleteFile(Uri.joinPath(workspaceFolder, '.vscode', 'profile.json'))
		deleteTestFiles()
	})

	teardown('proj9 - afterEach', async () => {
		deleteFile(testProfileJson)
		await workspace.fs.copy(testProfileBackup, testProfileJson, { overwrite: true }).then()
		// await workspace.fs.copy(testProfileBackup, testProfileJson, { overwrite: true }).then(() => {
		// 	log.info('teardown return')
		// 	return
		// }, (e) => {
		// 	log.error('teardown error: e=' + e)
		// 	throw e
		// })
	})

	suiteTeardown('proj9 - after', async () => {
		await workspace.fs.delete(testProfileBackup)
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
		await runAllTests(true, false)

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.3 - third profile passes (inherits propath from 2)', async () => {
		await selectProfile('profile3')
		await runAllTests(true, false)

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.4 - run default profile, then profile 3', async () => {
		await selectProfile('default')
		await runAllTests(true, false)
		await selectProfile('profile3')
		await runAllTests(true, false)

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.12 - second profile passes (config)', async () => {
		await updateTestProfile('openedgeProjectProfile', 'profile2')
		await runAllTests()

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

		await runAllTests(true, false).catch((e) => {
			log.info('runAllTests failed, as expected: e=' + e)
		})
		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')
		assert.notFileExists(resultsJson)
	})

})
