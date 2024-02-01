import { strict as assert } from 'assert'
import { before } from 'mocha'
import { Uri } from 'vscode'
import { beforeProj7, getTestCount, getWorkspaceUri, runAllTests } from '../testCommon'

const projName = 'proj7A'
const workspaceUri = getWorkspaceUri()

before(async () => {
	await beforeProj7()
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - test count', async () => {
		await runAllTests()

		const resultsJson = Uri.joinPath(workspaceUri, 'temp', 'results.json')
		const testCount = await getTestCount(resultsJson)
		assert(testCount > 1000, 'testCount should be > 100, but is ' + testCount)
	})

})
