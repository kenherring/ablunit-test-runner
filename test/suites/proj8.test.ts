import { getEnvVars } from '../../src/ABLUnitRun'
import { Uri, assert, getResults, getWorkspaceUri, runAllTests, waitForExtensionActive } from '../testCommon'

export default suite('proj8Suite', () => {

	suiteSetup('proj8 - suiteSetup', async () => {
		// await waitForExtensionActive()
	})

	test('proj8.1 - test count', async () => {
		await runAllTests()

		const resultsXml = Uri.joinPath(getWorkspaceUri(), 'target', 'results.xml')
		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'target', 'results.json')

		assert.fileExists(resultsXml)
		assert.fileExists(resultsJson)

		assert.count(2)
		assert.errored(0)
		assert.failed(0)
		assert.passed(2)
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
