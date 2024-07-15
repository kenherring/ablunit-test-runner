import { Uri } from 'vscode'
import { assert, getResults, getWorkspaceUri, runAllTests, suiteSetupCommon } from '../testCommon'
import { getEnvVars } from '../../src/ABLUnitRun'

const projName = 'proj8'

suite('proj8 - Extension Test Suite', () => {

	suiteSetup('proj8 - before', async () => {
		await suiteSetupCommon()
	})

	test('proj8.1 - test count', () => {
		return runAllTests()
			.then(() => {
				const resultsXml = Uri.joinPath(getWorkspaceUri(), 'target', 'results.xml')
				const resultsJson = Uri.joinPath(getWorkspaceUri(), 'target', 'results.json')

				assert.fileExists(resultsXml)
				assert.fileExists(resultsJson)

				assert.tests.count(2)
				assert.tests.errored(0)
				assert.tests.failed(0)
				assert.tests.passed(2)
				return
			})
	})

	test('proj8.2 - getEnvVars confirm PATH is set correctly', () => {
		return runAllTests()
			.then(() => { return getResults() })
			.then((r) => {
				if(!r[0]) {
					assert.fail('no results found')
				}
				return getEnvVars(r[0].dlc?.uri)
			})
			.then((envVars) => {
				if (!envVars['PATH']) {
					assert.fail('environment variable PATH is undefined')
					return
				}

				assert.assert(!envVars['PATH'].includes('${env:PATH}'), 'env should not contain ${env.PATH}, but does')
				return true
			})
	})

})
