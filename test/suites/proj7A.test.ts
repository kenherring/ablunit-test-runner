import { strict as assert } from 'assert'
import { Uri } from 'vscode'
import { beforeProj7, getTestCount, getWorkspaceUri, runAllTests } from '../testCommon'

const workspaceUri = getWorkspaceUri()

suite('proj7A - Extension Test Suite', () => {

	suiteSetup('proj7A - before', async () => {
		await beforeProj7()
	})

	test('proj7A.1 - test count', async () => {
		await runAllTests()

		const resultsJson = Uri.joinPath(workspaceUri, 'temp', 'results.json')
		const testCount = await getTestCount(resultsJson)
		assert(testCount > 1000, 'testCount should be > 1000, but is ' + testCount)
	})

})
