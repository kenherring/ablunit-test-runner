import { assert, deleteFile, getDefaultDLC, getSessionTempDir, getWorkspaceUri, oeVersion, runAllTests, setRuntimes, suiteSetupCommon, updateTestProfile, Uri } from '../testCommon'

const sessionTempDir = getSessionTempDir()

suite('proj4 - Extension Test Suite', () => {

	suiteSetup('proj4 - before', async () => {
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

	test('proj4.1 - Absolute Paths', async () => {
		const listingsDir = Uri.joinPath(sessionTempDir, 'listings')
		const resultsXml = Uri.joinPath(sessionTempDir, 'tempDir', 'results.xml')
		await updateTestProfile('profiler.listings', listingsDir.fsPath)
			.then(() => { return updateTestProfile('tempDir', Uri.joinPath(sessionTempDir, 'tempDir').fsPath) })
			.then(() => { return runAllTests() })
			.then(() => {
				assert.fileExists(resultsXml)
				assert.dirExists(listingsDir)
				return
			}, (e) => { throw e })
	})

	test('proj4.2 - tempDir=.builder/ablunit', async () => {
		await updateTestProfile('tempDir', '.builder/ablunit')
		const workspaceUri = getWorkspaceUri()
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri, '.builder', 'ablunit', 'ablunit.json')
		assert.fileExists(ablunitJson)
	})

	test('proj4.3 - tempDir=.builder/.ablunit', async () => {
		await updateTestProfile('tempDir', '.builder/.ablunit')
		await updateTestProfile('profiler.listings', '.builder/.ablunit/.listings')
		const workspaceUri = getWorkspaceUri()
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri, '.builder', '.ablunit', 'ablunit.json')
		const listingsDir = Uri.joinPath(workspaceUri, '.builder', '.ablunit', '.listings')
		assert.fileExists(ablunitJson)
		assert.dirExists(listingsDir)
	})

	test('proj4.4 - tempDir=target', async () => {
		const workspaceUri = getWorkspaceUri()
		const ablunitJson = Uri.joinPath(workspaceUri, 'target', 'ablunit.json')
		const progressIni = Uri.joinPath(workspaceUri, 'target', 'progress.ini')
		deleteFile(progressIni)
		await updateTestProfile('tempDir', 'target')
		await runAllTests()
		assert.fileExists(ablunitJson)
		if (process.platform === 'win32') {
			assert.fileExists(progressIni)
		}
	})

})
