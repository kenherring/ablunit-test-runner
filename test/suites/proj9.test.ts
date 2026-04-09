import { assert, deleteTestFiles, getTestCount, getWorkspaceUri, log, runAllTests, runTestsInFile, selectProfile, suiteSetupCommon, updateTestProfile, Uri, workspace } from '../testCommon'
import * as FileUtils from 'FileUtils'

const testProfileJson = Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json')
const testProfileBackup = Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json.backup')
const openedgeProjectJson = Uri.joinPath(getWorkspaceUri(), 'openedge-project.json')
const openedgeProjectBackup = Uri.joinPath(getWorkspaceUri(), 'openedge-project.json.backup')

suite('proj9 - Extension Test Suite', () => {

	suiteSetup('proj9 - before', async () => {
		await suiteSetupCommon()
		FileUtils.copyFile(testProfileJson, testProfileBackup)
		FileUtils.copyFile(openedgeProjectJson, openedgeProjectBackup)
	})

	setup('proj9 - beforeEach', () => {
		const workspaceFolder = workspace.workspaceFolders![0].uri
		FileUtils.deleteFile(Uri.joinPath(workspaceFolder, '.vscode', 'profile.json'))
		deleteTestFiles()
		return
	})

	teardown('proj9 - afterEach', () => {
		FileUtils.deleteFile(testProfileJson)
		FileUtils.copyFile(testProfileBackup, testProfileJson)
		FileUtils.copyFile(openedgeProjectBackup, openedgeProjectJson)
	})

	suiteTeardown('proj9 - after', () => {
		FileUtils.deleteFile(testProfileBackup)
		FileUtils.deleteFile(openedgeProjectBackup)
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

		assert.equal(await getTestCount(resultsJson, 'pass'), 8, 'passed test count')
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

	test('proj9.13a - db connections in NoDB-profile are used (none)', async () => {
		FileUtils.copyFile('.vscode/ablunit-test-profile.test13.json', '.vscode/ablunit-test-profile.json')
		FileUtils.copyFile('openedge-project.test13.json', 'openedge-project.json')

		await selectProfile('NoDB-profile')
		await runTestsInFile('src/numdbsTest.p')

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 0, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 1, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.13b - db connections in default profile are used (one)', async () => {
		FileUtils.copyFile('.vscode/ablunit-test-profile.test13.json', '.vscode/ablunit-test-profile.json')
		FileUtils.copyFile('openedge-project.test13.json', 'openedge-project.json')

		await runTestsInFile('src/numdbsTest.p')

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 1, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.13c - db connections in inherited-profile are used (none)', async () => {
		FileUtils.copyFile('.vscode/ablunit-test-profile.test13.json', '.vscode/ablunit-test-profile.json')
		FileUtils.copyFile('openedge-project.test13.json', 'openedge-project.json')

		await selectProfile('inherited-profile')
		await runTestsInFile('src/numdbsTest.p')

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 0, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 1, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.13d - db connections in inherited-profile2 are used (one)', async () => {
		FileUtils.copyFile('.vscode/ablunit-test-profile.test13.json', '.vscode/ablunit-test-profile.json')
		FileUtils.copyFile('openedge-project.test13.json', 'openedge-project.json')

		await selectProfile('inherited-profile2')
		await runTestsInFile('src/numdbsTest.p')

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder, 'results.json')

		assert.fileExists(resultsJson)
		assert.equal(await getTestCount(resultsJson, 'pass'), 1, 'passed test count')
		assert.equal(await getTestCount(resultsJson, 'fail'), 0, 'failed test count')
		assert.equal(await getTestCount(resultsJson, 'error'), 0, 'error test count')
	})

	test('proj9.20 - do not import openedge-project.json', async () => {
		await updateTestProfile('importOpenedgeProjectJson', false)
			.then(() => { return updateTestProfile('openedgeProjectProfile', 'profile2') })
			.then(() => { return runAllTests(true, false) })
			.then(() => {
				log.error('expected runAllTests to fail, but it did not')
				return assert.fail('expected runAllTests to fail, but it did not')
			}, (e: unknown) => {
				log.info('runAllTests failed, as expected: e=' + e)
				assert.notFileExists(Uri.joinPath(workspace.workspaceFolders![0].uri, 'results.json'))
				return // nosonar
			})
	})

})
