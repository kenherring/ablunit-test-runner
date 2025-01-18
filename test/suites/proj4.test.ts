import { assert, getDefaultDLC, getWorkspaceUri, oeVersion, runAllTests, runAllTestsWithCoverage, setRuntimes, suiteSetupCommon, updateTestProfile, Uri } from '../testCommon'
import * as FileUtils from '../../src/FileUtils'

const sessionTempDir = getSessionTempDir()


function getSessionTempDir () {
	if (process.platform === 'win32') {
		return Uri.file('c:/temp/ablunit')
	}
	if(process.platform === 'linux') {
		return Uri.file('/tmp/ablunit')
	}
	throw new Error('Unsupported platform: ' + process.platform)
}

suite('proj4 - Extension Test Suite', () => {

	suiteSetup('proj4 - before', async () => {
		if (!FileUtils.doesFileExist('.vscode/settings.json') && FileUtils.doesFileExist('.vscode/settings.json.bk')) {
			FileUtils.copyFile('.vscode/settings.json.bk', '.vscode/settings.json')
		}
		await suiteSetupCommon()
		if (process.platform === 'linux') {
			await updateTestProfile('tempDir', '/tmp/ablunit')
			await updateTestProfile('profiler.listings', '/tmp/ablunit-local/listings')
		}
	})

	setup('proj4 - beforeEach', async () => {
		await setRuntimes([{name: '11.7', path: '/psc/dlc_11.7'}, {name: oeVersion(), path: getDefaultDLC(), default: true}])
	})

	teardown('proj4 - afterEach', async () => {
		await updateTestProfile('tempDir', 'c:\\temp\\ablunit\\tempDir')
		await updateTestProfile('profiler.listings', 'c:\\temp\\ablunit-local\\listings')
	})

	test('proj4.1 - Absolute Paths', () => {
		const listingsDir = Uri.joinPath(sessionTempDir, 'listings')
		const resultsXml = Uri.joinPath(sessionTempDir, 'tempDir', 'results.xml')
		FileUtils.deleteDir(listingsDir)
		FileUtils.deleteFile(resultsXml)

		const prom = updateTestProfile('profiler.listings', listingsDir.fsPath)
			.then(() => { return updateTestProfile('tempDir', Uri.joinPath(sessionTempDir, 'tempDir').fsPath) })
			.then(() => { return runAllTests() })
			.then(() => {
				assert.fileExists(resultsXml)
				assert.notDirExists(listingsDir)

				FileUtils.deleteDir(listingsDir)
				FileUtils.deleteFile(resultsXml)
				return true
			}, (e: unknown) => { throw e })
		return prom
	})

	test('proj4.2 - Absolute Paths w/ coverage', () => {
		const listingsDir = Uri.joinPath(sessionTempDir, 'listings')
		const resultsXml = Uri.joinPath(sessionTempDir, 'tempDir', 'results.xml')
		FileUtils.deleteDir(listingsDir)
		FileUtils.deleteFile(resultsXml)

		const prom = updateTestProfile('profiler.listings', listingsDir.fsPath)
			.then(() => { return updateTestProfile('tempDir', Uri.joinPath(sessionTempDir, 'tempDir').fsPath) })
			.then(() => { return runAllTestsWithCoverage() })
			.then(() => {
				assert.dirExists(listingsDir)
				assert.fileExists(resultsXml)

				FileUtils.deleteDir(listingsDir)
				FileUtils.deleteFile(resultsXml)
				return true
			}, (e: unknown) => { throw e })
		return prom
	})

	test('proj4.3 - tempDir=.builder/ablunit', async () => {
		await updateTestProfile('tempDir', '.builder/ablunit')
		const workspaceUri = getWorkspaceUri()
		const ablunitJson = Uri.joinPath(workspaceUri, '.builder', 'ablunit', 'ablunit.json')
		FileUtils.deleteFile(ablunitJson)

		await runAllTests()
		assert.fileExists(ablunitJson)

		FileUtils.deleteFile(ablunitJson)
	})

	test('proj4.4 - tempDir=.builder/.ablunit', async () => {
		await updateTestProfile('tempDir', '.builder/.ablunit')
		await updateTestProfile('profiler.listings', '.builder/.ablunit/.listings')
		const workspaceUri = getWorkspaceUri()
		const ablunitJson = Uri.joinPath(workspaceUri, '.builder', '.ablunit', 'ablunit.json')
		const listingsDir = Uri.joinPath(workspaceUri, '.builder', '.ablunit', '.listings')
		FileUtils.deleteFile(ablunitJson)
		FileUtils.deleteDir(listingsDir)

		await runAllTests()
		assert.fileExists(ablunitJson)
		assert.notDirExists(listingsDir)

		FileUtils.deleteFile(ablunitJson)
		FileUtils.deleteDir(listingsDir)
	})

	test('proj4.5 - tempDir=.builder/.ablunit', async () => {
		await updateTestProfile('tempDir', '.builder/.ablunit')
		await updateTestProfile('profiler.listings', '.builder/.ablunit/.listings')
		const workspaceUri = getWorkspaceUri()
		const ablunitJson = Uri.joinPath(workspaceUri, '.builder', '.ablunit', 'ablunit.json')
		const listingsDir = Uri.joinPath(workspaceUri, '.builder', '.ablunit', '.listings')
		FileUtils.deleteFile(ablunitJson)
		FileUtils.deleteDir(listingsDir)

		await runAllTestsWithCoverage()
		assert.fileExists(ablunitJson)
		assert.dirExists(listingsDir)

		FileUtils.deleteFile(ablunitJson)
		FileUtils.deleteDir(listingsDir)
	})

	test('proj4.6 - tempDir=target', async () => {
		const workspaceUri = getWorkspaceUri()
		const ablunitJson = Uri.joinPath(workspaceUri, 'target', 'ablunit.json')
		const progressIni = Uri.joinPath(workspaceUri, 'target', 'progress.ini')
		FileUtils.deleteFile([ablunitJson, progressIni])

		await updateTestProfile('tempDir', 'target')
		await runAllTests()
		assert.fileExists(ablunitJson)
		if (process.platform === 'win32') {
			assert.fileExists(progressIni)
		}

		FileUtils.deleteFile(ablunitJson)
		FileUtils.deleteFile(progressIni)
	})

})
