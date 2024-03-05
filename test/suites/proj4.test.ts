import { doesDirExist } from '../../src/ABLUnitCommon'
import { Uri, assert, deleteFile, doesFileExist, getDefaultDLC, getSessionTempDir, getWorkspaceUri, isoDate, log, runAllTests, suiteSetupCommon, updateTestProfile, workspace } from '../testCommon'

suite('proj4Suite', () => {

	suiteSetup('proj3 - suiteSetup', suiteSetupCommon)

	setup('proj4 - setup', async () => {
		// await setRuntimes([{name: '11.7', path: '/psc/dlc_11.7'}, {name: '12.2', path: getDefaultDLC()}])
		const conf = workspace.getConfiguration('abl')
		log.info(isoDate() + ' proj4.1 - 1.2 conf=' + JSON.stringify(conf))
		await conf.update('configuration.runtimes', [{name: '11.7', path: '/psc/dlc_11.7'}, {name: '12.2', path: getDefaultDLC(), default: true}]).then(
			() => { log.info(isoDate() + ' proj4.1 - 1.3') },
			(e) => { log.error(isoDate() + ' proj4.1 - 1.4 e=' + e) }
		)
		if (process.platform === 'linux') {
			await updateTestProfile('tempDir', '/tmp/ablunit')
			await updateTestProfile('profiler.listings', '/tmp/ablunit-local/listings')
		}
	})

	teardown('proj4 - teardownn', async () => {
		await updateTestProfile('tempDir', 'c:\\temp\\ablunit\\tempDir')
		await updateTestProfile('profiler.listings', 'c:\\temp\\ablunit-local\\listings')
	})

	test('proj4.1 - Absolute Paths', async () => {
		const sessionTempDir = getSessionTempDir()
		const listingsDir = Uri.joinPath(sessionTempDir, 'listings')
		const resultsXml = Uri.joinPath(sessionTempDir, 'tempDir', 'results.xml')
		await updateTestProfile('profiler.listings', listingsDir.fsPath)
		await updateTestProfile('tempDir', Uri.joinPath(sessionTempDir, 'tempDir').fsPath)

		await runAllTests()

		assert.assert(doesFileExist(resultsXml), 'missing results file (' + resultsXml.fsPath + ')')
		assert.assert(doesDirExist(listingsDir), 'missing listings directory (' + listingsDir.fsPath + ')')
	})

	test('proj4.2 - tempDir=.builder/ablunit', async () => {
		await updateTestProfile('tempDir', '.builder/ablunit')
		const workspaceUri = getWorkspaceUri()
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri, '.builder', 'ablunit', 'ablunit.json')
		assert.assert(doesFileExist(ablunitJson), 'missing ablunit.json (' + ablunitJson.fsPath + ')')
	})

	test('proj4.3 - tempDir=.builder/.ablunit', async () => {
		await updateTestProfile('tempDir', '.builder/.ablunit')
		await updateTestProfile('profiler.listings', '.builder/.ablunit/.listings')
		const workspaceUri = getWorkspaceUri()
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri, '.builder', '.ablunit', 'ablunit.json')
		const listingsDir = Uri.joinPath(workspaceUri, '.builder', '.ablunit', '.listings')
		assert.assert(doesFileExist(ablunitJson), 'missing ablunit.json (' + ablunitJson.fsPath + ')')
		assert.assert(doesDirExist(listingsDir), 'missing listings directory (' + listingsDir.fsPath + ')')
	})

	test('proj4.4 - tempDir=target', async () => {
		const workspaceUri = getWorkspaceUri()
		const ablunitJson = Uri.joinPath(workspaceUri, 'target', 'ablunit.json')
		const progressIni = Uri.joinPath(workspaceUri, 'target', 'progress.ini')
		deleteFile(progressIni)
		await updateTestProfile('tempDir', 'target')
		await runAllTests()
		assert.assert(doesFileExist(ablunitJson), 'missing ablunit.json (' + ablunitJson.fsPath + ')')
		if (process.platform === 'win32') {
			assert.assert(doesFileExist(progressIni), 'missing progress.ini (' + progressIni.fsPath + ')')
		}
	})

})
