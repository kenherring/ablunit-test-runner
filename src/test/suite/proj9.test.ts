import { strict as assert } from 'assert'
import { after, afterEach, before, beforeEach } from 'mocha'
import { Uri, workspace } from 'vscode'
import { deleteFile, doesFileExist, getTestCount, getWorkspaceUri, runAllTests, selectProfile, updateTestProfile, waitForExtensionActive } from '../testCommon'

// const projName = __dirname.split(/[\\/]/).pop()!
const projName = "proj9"
const testProfileJson = Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json')
const testProfileBackup = Uri.joinPath(getWorkspaceUri(), '.vscode/ablunit-test-profile.json.backup')

before(async () => {
	await workspace.fs.copy(testProfileJson, testProfileBackup, { overwrite: true }).then()
})

beforeEach(async () => {
	const workspaceFolder = workspace.workspaceFolders![0].uri
	await waitForExtensionActive()
	await deleteFile(Uri.joinPath(workspaceFolder,'.vscode/profile.json'))
})

afterEach(async () => {
	await deleteFile(testProfileJson)
	await workspace.fs.copy(testProfileBackup, testProfileJson, { overwrite: true }).then()
})

after(async () => {
	await workspace.fs.delete(testProfileBackup)
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - ${workspaceFolder}/ablunit.json file exists', async () => {
		await runAllTests()
		const workspaceFolder = workspace.workspaceFolders![0].uri
		const ablunitJson = Uri.joinPath(workspaceFolder,'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceFolder,'results.xml')
		const resultsJson = Uri.joinPath(workspaceFolder,'results.json')

		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")

		assert.equal(await getTestCount(resultsJson,'pass'),7,"passed test count")
		assert.equal(await getTestCount(resultsJson,'fail'),0,"failed test count")
		assert.equal(await getTestCount(resultsJson,'error'),0,"error test count")
	})

	test(projName + '.2 - second profile passes (project)', async () => {
		await selectProfile('profile2')
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder,'results.json')

		assert(await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")
		assert.equal(await getTestCount(resultsJson,'pass'),2,"passed test count")
		assert.equal(await getTestCount(resultsJson,'fail'),0,"failed test count")
		assert.equal(await getTestCount(resultsJson,'error'),0,"error test count")
	})

	test(projName + '.3 - third profile passes (inherits propath from 2)', async () => {
		await selectProfile('profile3')
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder,'results.json')

		assert(await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")
		assert.equal(await getTestCount(resultsJson,'pass'),2,"passed test count")
		assert.equal(await getTestCount(resultsJson,'fail'),0,"failed test count")
		assert.equal(await getTestCount(resultsJson,'error'),0,"error test count")
	})

	test(projName + '.4 - run default profile, then profile 3', async () => {
		await selectProfile('default')
		await runAllTests()
		await selectProfile('profile3')
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder,'results.json')

		assert(await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")
		assert.equal(await getTestCount(resultsJson,'pass'),2,"passed test count")
		assert.equal(await getTestCount(resultsJson,'fail'),0,"failed test count")
		assert.equal(await getTestCount(resultsJson,'error'),0,"error test count")
	})

	test(projName + '.12 - second profile passes (config)', async () => {
		await updateTestProfile('openedgeProjectProfile', 'profile2')
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder,'results.json')

		assert(await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")
		assert.equal(await getTestCount(resultsJson,'pass'),2,"passed test count")
		assert.equal(await getTestCount(resultsJson,'fail'),0,"failed test count")
		assert.equal(await getTestCount(resultsJson,'error'),0,"error test count")
	})

	test(projName + '.20 - do not import openedge-project.json', async () => {
		await updateTestProfile('importOpenedgeProjectJson', false)
		await updateTestProfile('openedgeProjectProfile', 'profile2')

		await runAllTests()
		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder,'results.json')
		assert(! await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")
	})

})
