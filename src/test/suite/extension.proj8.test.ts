import * as assert from 'assert'
import { before } from 'mocha'
import { Uri, workspace } from 'vscode'
import { doesFileExist, getTestCount, getWorkspaceUri, runAllTests, waitForExtensionActive } from '../testCommon'

const projName = 'proj8'
const workspaceUri = getWorkspaceUri()

function getUri (path: string) {
	return Uri.joinPath(workspaceUri, path)
}

before(async () => {
	await waitForExtensionActive()
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - test count', async () => {
		await runAllTests()

		const resultsXml = Uri.joinPath(workspaceUri,'target','results.xml')
		const resultsJson = Uri.joinPath(workspaceUri,'target','results.json')

		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(await doesFileExist(resultsJson), "missing results.xml (" + resultsJson.fsPath + ")")

		const testCount = await getTestCount(resultsJson)
		assert(testCount === 10, "testCount should be 10, but is " + testCount)
	})

})
