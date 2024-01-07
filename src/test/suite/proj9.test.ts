import { strict as assert } from 'assert'
import { before } from 'mocha'
import { Uri, workspace } from 'vscode'
import { deleteFile, doesFileExist, getTestCount, runAllTests, selectProfile, waitForExtensionActive } from '../testCommon'

// const projName = __dirname.split(/[\\/]/).pop()!
const projName = "proj9"

before(async () => {
	const workspaceFolder = workspace.workspaceFolders![0].uri
	await waitForExtensionActive()
	await deleteFile(Uri.joinPath(workspaceFolder,'.vscode/profile.json'))
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

		assert.equal(7,await getTestCount(resultsJson,'pass'),"passed test count")
		assert.equal(0,await getTestCount(resultsJson,'fail'),"failed test count")
		assert.equal(0,await getTestCount(resultsJson,'error'),"error test count")
	})

	test(projName + '.2 - second profile passes', async () => {
		// command: abl.project.switch.profile
		// command: abl.restart.langserv
		await selectProfile('profile2')
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder,'results.json')

		assert(await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")
		assert.equal(2,await getTestCount(resultsJson,'pass'),"passed test count")
		assert.equal(0,await getTestCount(resultsJson,'fail'),"failed test count")
		assert.equal(0,await getTestCount(resultsJson,'error'),"error test count")
	})

	test(projName + '.3 - third profile passes (inherits propath from 2)', async () => {
		await selectProfile('profile3')
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder,'results.json')

		assert(await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")
		assert.equal(2,await getTestCount(resultsJson,'pass'),"passed test count")
		assert.equal(0,await getTestCount(resultsJson,'fail'),"failed test count")
		assert.equal(0,await getTestCount(resultsJson,'error'),"error test count")
	})

	test(projName + '.4 - run default profile, then profile 3', async () => {
		await selectProfile('default')
		await runAllTests()
		await selectProfile('profile3')
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceFolder,'results.json')

		assert(await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")
		assert.equal(2,await getTestCount(resultsJson,'pass'),"passed test count")
		assert.equal(0,await getTestCount(resultsJson,'fail'),"failed test count")
		assert.equal(0,await getTestCount(resultsJson,'error'),"error test count")
	})

})
