import { assert, beforeProj7, getTestCount, getWorkspaceUri, runAllTests, suiteSetupCommon, Uri } from '../testCommon'

const workspaceUri = getWorkspaceUri()

suite('proj7ASuite', () => {

	suiteSetup('proj7A - suiteSetup', async () => beforeProj7())

	test('proj7A.1 - test count', async () => {
		await runAllTests()

		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'temp', 'results.json')
		const testCount = await getTestCount(resultsJson)
		assert.assert(testCount > 1000, 'testCount should be > 100, but is ' + testCount)
	})

})
