import { strict as assert } from 'assert'
import { before } from 'mocha'
import { Uri, workspace } from 'vscode'
import { assertResults, doesFileExist, runAllTests, waitForExtensionActive } from '../testCommon'

const projName = 'projA'

before(async () => {
	await waitForExtensionActive()
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - no .vscode/ablunit-test-profile.json exists in project', async () => {
		await runAllTests()

		const workspaceFolder = workspace.workspaceFolders![0].uri
		const ablunitJson = Uri.joinPath(workspaceFolder,'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceFolder,'results.xml')

		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		// await assertResults.count(1)
		// await assertResults.passed(1)
		// await assertResults.errored(0)
		// await assertResults.failed(0)
	})

})
