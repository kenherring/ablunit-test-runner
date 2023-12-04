import * as assert from 'assert'
import { before } from 'mocha'
import path = require('path')
import { Uri } from 'vscode'
import { getWorkspaceUri, runAllTests, doesFileExist, waitForExtensionActive } from '../testCommon'

const projName = 'proj6'
const workspaceUri = getWorkspaceUri()

before(async () => {
	await waitForExtensionActive()
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - ablunit json file', async () => {
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri,'.ablunit','ablunit.json')
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
	})

})
