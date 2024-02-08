import { before } from 'mocha'
import { Uri } from 'vscode'
import { assert, getWorkspaceUri, runAllTests, waitForExtensionActive } from 'testCommon'

const projName = 'proj6'
const workspaceUri = getWorkspaceUri()

suite(projName + ' - Extension Test Suite', () => {

	before(projName + ' - before', async () => {
		await waitForExtensionActive()
	})

	test(projName + '.1 - tempDir=.ablunit', async () => {
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri, '.ablunit', 'ablunit.json')
		assert.fileExists(ablunitJson)
	})

})
