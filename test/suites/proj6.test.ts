import { Uri, assert, getWorkspaceUri, runAllTests, suiteSetupCommon } from '../testCommon'

suite('proj6Suite', () => {

	suiteSetup('proj3 - suiteSetup', suiteSetupCommon)

	// suiteSetup('proj6 - suiteSetup', async () => {
	// 	await waitForExtensionActive()
	// })

	test('proj6.1 - tempDir=.ablunit', async () => {
		await runAllTests()
		const ablunitJson = Uri.joinPath(getWorkspaceUri(), '.ablunit', 'ablunit.json')
		assert.fileExists(ablunitJson)
	})

})
