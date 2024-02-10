import { after, afterEach, before, beforeEach } from 'mocha'
import { Uri, workspace } from 'vscode'
import { assert, deleteFile, getTestCount, getWorkspaceUri, runAllTests, selectProfile, updateTestProfile, waitForExtensionActive } from '../testCommon'

// const projName = __dirname.split(/[\\/]/).pop()!
const projName = 'proj9'
const testProfileJson = Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json')
const testProfileBackup = Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json.backup')

suite(projName + ' - Extension Test Suite', () => {

	before(projName + ' - before', async () => {
		await workspace.fs.copy(testProfileJson, testProfileBackup, { overwrite: true }).then()
	})

	beforeEach(projName + ' - beforeEach', async () => {
		const workspaceFolder = workspace.workspaceFolders![0].uri
		await waitForExtensionActive()
		deleteFile(Uri.joinPath(workspaceFolder, '.vscode/profile.json'))
	})

	afterEach(projName + ' - afterEach', async () => {
		deleteFile(testProfileJson)
		await workspace.fs.copy(testProfileBackup, testProfileJson, { overwrite: true }).then()
	})

	after(projName + ' - after', async () => {
		await workspace.fs.delete(testProfileBackup)
	})

	test(projName + '.1 - ${workspaceFolder}/ablunit.json file exists', async () => {
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

	test(projName + '.2 - second profile passes (project)', async () => {
		await selectProfile('profile2')
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test(projName + '.3 - third profile passes (inherits propath from 2)', async () => {
		await selectProfile('profile3')
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test(projName + '.4 - run default profile, then profile 3', async () => {
		await selectProfile('default')
		await runAllTests()
		await selectProfile('profile3')
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test(projName + '.12 - second profile passes (config)', async () => {
		await updateTestProfile('openedgeProjectProfile', 'profile2')
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 2, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test(projName + '.20 - do not import openedge-project.json', async () => {
		await updateTestProfile('importOpenedgeProjectJson', false)
		await updateTestProfile('openedgeProjectProfile', 'profile2')

		await runAllTests()
		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')
		assert.notFileExists(resultsJson)
	})

})
