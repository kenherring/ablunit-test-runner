import { strict as assert } from 'assert'
import { before } from 'mocha'
import { Uri, workspace } from 'vscode'
import { deleteFile, doesFileExist, getTestCount, runAllTests, selectProfile, waitForExtensionActive } from '../testCommon'

// const projName = __dirname.split(/[\\/]/).pop()!
const projName = "proj9"

before(async () => {
	const workspaceDir = workspace.workspaceFolders![0].uri
	await waitForExtensionActive()
	await deleteFile(Uri.joinPath(workspaceDir,'.vscode/profile.json'))
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - ${workspaceDir}/ablunit.json file exists', async () => {
		await runAllTests()

		const workspaceDir = workspace.workspaceFolders![0].uri

		const ablunitJson = Uri.joinPath(workspaceDir,'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceDir,'results.xml')
		const resultsJson = Uri.joinPath(workspaceDir,'results.json')

		console.log("workspaceDir= " + workspaceDir.fsPath)
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
		const resp = await selectProfile('profile2')
		console.log("resp=" + resp)
		await runAllTests()

		const workspaceDir = workspace.workspaceFolders![0].uri
		const resultsJson = Uri.joinPath(workspaceDir,'results.json')
		assert(await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")

		assert.equal(2,await getTestCount(resultsJson,'pass'),"passed test count")
		assert.equal(0,await getTestCount(resultsJson,'fail'),"failed test count")
		assert.equal(0,await getTestCount(resultsJson,'error'),"error test count")
	})

})