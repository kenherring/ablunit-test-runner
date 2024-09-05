import { Uri, assert, deleteFile, getTestCount, getWorkspaceUri, log, runAllTests, selectProfile, suiteSetupCommon, updateTestProfile, workspace } from '../testCommon'

const testProfileJson = () => Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json')
const testProfileBackup = () => Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json.backup')

suite('proj9Suite', () => {

	suiteSetup('proj9 - suiteSetup', suiteSetupCommon)

	suiteSetup('proj9 - suiteSetup', async () => {
		await workspace.fs.copy(testProfileJson(), testProfileBackup(), { overwrite: true }).then()
	})

	setup('proj9 - setup', () => {
		const workspaceFolder = workspace.workspaceFolders![0].uri
		// await waitForExtensionActive()
		deleteFile(Uri.joinPath(workspaceFolder, '.vscode/profile.json'))
	})

	teardown('proj9 - teardown', async () => {
		deleteFile(testProfileJson())
		await workspace.fs.copy(testProfileBackup(), testProfileJson(), { overwrite: true }).then()
	})

	suiteTeardown('proj9 - suiteTeardown', async () => {
		await workspace.fs.delete(testProfileBackup())
	})

	test('proj91 - ${workspaceFolder}/ablunit.json file exists', async () => {
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
			.then(() => { return runAllTests() })
			.then(() => { assert.fileExists(resultsJsonUri) })
		assert.equal(await getTestCount(resultsJsonUri, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJsonUri, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJsonUri, 'error'), 0, 'error test count')
	})

	test('proj9.4 - run default profile, then profile 3', async () => {
		await selectProfile('default')
			.then(() => { return runAllTests() })
			.then(() => { return selectProfile('profile3') })
			.then(() => { return runAllTests() })

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
			.then(() => { return updateTestProfile('openedgeProjectProfile', 'profile2') })
			.then(() => { return runAllTests(true, false) })
			.catch((e: unknown) => { log.info('runAllTests failed, as expected: e=' + e) })
		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')
		assert.notFileExists(resultsJson)
	})

})
