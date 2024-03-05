import { Uri, assert, runAllTests, suiteSetupCommon, workspace } from '../testCommon'


suite('projASuite', () => {

	suiteSetup('projA - suiteSetup', suiteSetupCommon)

	test('projA.1 - no .vscode/ablunit-test-profile.json exists in project', async () => {
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const ablunitJson = Uri.joinPath(workspaceFolder, 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceFolder, 'results.xml')

		assert.fileExists(ablunitJson)
		assert.fileExists(resultsXml)
		// await assertResults.count(1)
		// await assertResults.passed(1)
		// await assertResults.errored(0)
		// await assertResults.failed(0)
	})

})
