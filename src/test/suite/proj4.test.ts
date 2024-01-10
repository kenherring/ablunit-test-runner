import { strict as assert } from 'assert'
import { after, before, beforeEach } from 'mocha'
import { Uri } from 'vscode'
import { deleteFile, doesDirExist, doesFileExist, getDefaultDLC, getSessionTempDir, getWorkspaceUri, runAllTests, setRuntimes, updateTestProfile, waitForExtensionActive } from '../testCommon'


const projName = 'proj4'
const sessionTempDir = Uri.parse(getSessionTempDir())


before(async () => {
	await waitForExtensionActive()
	if (process.platform === 'linux') {
		await updateTestProfile("tempDir", "/tmp/ablunit")
		await updateTestProfile("profiler.listings", "/tmp/ablunit-local/listings")
	}
})

beforeEach(async () => {
	await setRuntimes([{name: "11.7", path: "/psc/dlc_11.7"},{name: "12.2", path: getDefaultDLC()}])
})

after(async () => {
	await updateTestProfile("tempDir", "c:\\temp\\ablunit\\tempDir")
	await updateTestProfile("profiler.listings", "c:\\temp\\ablunit-local\\listings")
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - Absolute Paths', async () => {
		const listingsDir = Uri.joinPath(sessionTempDir,'listings')
		const resultsXml = Uri.joinPath(sessionTempDir,'tempDir','results.xml')
		await updateTestProfile("profiler.listings", listingsDir.fsPath)
		await updateTestProfile("tempDir", Uri.joinPath(sessionTempDir,'tempDir').fsPath)

		await runAllTests()

		assert(await doesFileExist(resultsXml),"missing results file (" + resultsXml.fsPath + ")")
		assert(await doesDirExist(listingsDir),"missing listings directory (" + listingsDir.fsPath + ")")
	})

	test(projName + '.2 - tempDir=.builder/ablunit', async () => {
		await updateTestProfile("tempDir", ".builder/ablunit")
		const workspaceUri = getWorkspaceUri()
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri,'.builder', 'ablunit','ablunit.json')
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
	})

	test(projName + '.3 - tempDir=.builder/.ablunit', async () => {
		await updateTestProfile("tempDir", ".builder/.ablunit")
		await updateTestProfile("profiler.listings", ".builder/.ablunit/.listings")
		const workspaceUri = getWorkspaceUri()
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri,'.builder', '.ablunit', 'ablunit.json')
		const listingsDir = Uri.joinPath(workspaceUri,'.builder', '.ablunit', '.listings')
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesDirExist(listingsDir),"missing listings directory (" + listingsDir.fsPath + ")")
	})

	test(projName + '.4 - tempDir=target', async () => {
		const workspaceUri = getWorkspaceUri()
		const ablunitJson = Uri.joinPath(workspaceUri,'target', 'ablunit.json')
		const progressIni = Uri.joinPath(workspaceUri,'target','progress.ini')
		await deleteFile(progressIni)
		await updateTestProfile('tempDir','target')
		await runAllTests()
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		if (process.platform === 'win32') {
			assert(await doesFileExist(progressIni), "missing progress.ini (" + progressIni.fsPath + ")")
		}
	})

})
