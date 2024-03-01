import { strict as assert } from 'assert'
import { Uri } from 'vscode'
import { beforeProj7, getTestCount, getWorkspaceUri, runAllTests } from '../testCommon'

suite('proj7ASuite', () => {

	suiteSetup('proj7A - suiteSetup', beforeProj7)

	test('proj7A.1 - test count', async () => {
		await runAllTests()

		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'temp', 'results.json')
		const testCount = await getTestCount(resultsJson)
		assert(testCount > 1000, 'testCount should be > 100, but is ' + testCount)
	})

})
