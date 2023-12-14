import * as assert from 'assert'
import { before } from 'mocha'
import { Uri } from 'vscode'
import { doesFileExist, getWorkspaceUri, runAllTests, waitForExtensionActive } from '../testCommon'


const projName = 'proj2'
const workspaceUri = getWorkspaceUri()

before(async () => {
	await waitForExtensionActive()
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - temp/ablunit.json file exists', async () => {
		await runAllTests()

		const ablunitJson = Uri.joinPath(workspaceUri,'temp','ablunit.json')
		assert(await doesFileExist(ablunitJson),"missing ablunit.json (" + ablunitJson.fsPath + ")")
	})

})
