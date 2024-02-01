import { before } from 'mocha'
import { Uri } from 'vscode'
import { assert, getResults, getWorkspaceUri, runAllTests, waitForExtensionActive } from '../testCommon'
import { getEnvVars } from '../../ABLUnitRun'

const projName = 'proj8'

before(async () => {
	await waitForExtensionActive()
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - test count', async () => {
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

	test(projName + '.2 - getEnvVars confirm PATH is set correctly', async () => {
		await runAllTests()
		const recentResults = getResults()
		const res = recentResults?.[0]
		if (!res) {
			assert.fail('res is null')
			return
		}
		const envVars = getEnvVars(res.dlc?.uri)
		const envPath = envVars['PATH']
		if (envPath) {
			assert.assert(!envPath.includes('${env:PATH}'), 'env should not contain ${env.PATH}, but does')
		} else {
			assert.fail('env is undefined')
		}
	})

})
