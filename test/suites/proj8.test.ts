import { Uri } from 'vscode'
import { assert, getResults, getWorkspaceUri, runAllTests, suiteSetupCommon } from '../testCommon'
import { getEnvVars } from '../../src/ABLUnitRun'


suite('proj8 - Extension Test Suite', () => {

	suiteSetup('proj8 - before', async () => suiteSetupCommon())

	test('proj8.1 - test count', async () => {
		await runAllTests()

		const resultsXml = Uri.joinPath(getWorkspaceUri(), 'target', 'results.xml')
		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'target', 'results.json')

		assert.fileExists(resultsXml)
		assert.fileExists(resultsJson)

		assert.tests.count(2)
		assert.tests.errored(0)
		assert.tests.failed(0)
		assert.tests.passed(2)
	})

	test('proj8.2 - getEnvVars confirm PATH is set correctly', async () => {
		await runAllTests()
		const recentResults = await getResults()
		const res = recentResults[0]
		const envVars = getEnvVars(res.dlc?.uri)
		const envPath = envVars['PATH']
		if (envPath) {
			assert.assert(!envPath.includes('${env:PATH}'), 'env should not contain ${env.PATH}, but does')
		} else {
			assert.fail('env is undefined')
		}
	})

})
