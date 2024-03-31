import { Uri } from 'vscode'
import { assert, getWorkspaceUri, runAllTests, waitForExtensionActive } from '../testCommon'

const projName = 'proj6'
const workspaceUri = getWorkspaceUri()

suite('proj6 - Extension Test Suite', () => {

	suiteSetup('proj6 - before', async () => {
		await waitForExtensionActive()
	})

	test('proj6.1 - tempDir=.ablunit', async () => {
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri, '.ablunit', 'ablunit.json')
		assert.fileExists(ablunitJson)
	})

})
