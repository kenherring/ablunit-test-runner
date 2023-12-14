import * as assert from 'assert'
import { before } from 'mocha'
import { Uri } from 'vscode'
import { doesFileExist, getTestCount, getWorkspaceUri, runAllTests, waitForExtensionActive } from '../testCommon'

const projName = 'proj8'

before(async () => {
	await waitForExtensionActive()
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - test count', async () => {
		await runAllTests()

		const resultsXml = Uri.joinPath(getWorkspaceUri(),'target','results.xml')
		const resultsJson = Uri.joinPath(getWorkspaceUri(),'target','results.json')

		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")

		const testCount = await getTestCount(resultsJson)
		assert(testCount === 2, "testCount should be 10, but is " + testCount)
	})

})
