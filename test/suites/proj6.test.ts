import { Uri, assert, getWorkspaceUri, runAllTests, waitForExtensionActive } from '../testCommon'

export default suite('proj6Suite', () => {

	suiteSetup('proj6 - suiteSetup', async () => {
		// await openWorkspaceFolder('proj6_dot_dir')
		await waitForExtensionActive()
	})

	test('proj6.1 - tempDir=.ablunit', async () => {
		await runAllTests()
		const ablunitJson = Uri.joinPath(getWorkspaceUri(), '.ablunit', 'ablunit.json')
		assert.fileExists(ablunitJson)
	})

})
