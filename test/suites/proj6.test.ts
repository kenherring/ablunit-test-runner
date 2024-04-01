import { Uri } from 'vscode'
import { assert, getWorkspaceUri, runAllTests, suiteSetupCommon } from '../testCommon'

const workspaceUri = getWorkspaceUri()

suite('proj6 - Extension Test Suite', () => {

	suiteSetup('proj6 - before', async () => suiteSetupCommon())

	test('proj6.1 - tempDir=.ablunit', async () => {
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri, '.ablunit', 'ablunit.json')
		assert.fileExists(ablunitJson)
	})

})
