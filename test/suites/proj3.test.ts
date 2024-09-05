import { Uri } from 'vscode'
import { assert, getDefaultDLC, getWorkspaceUri, oeVersion, runAllTests, suiteSetupCommon } from '../testCommon'
import { setRuntimes } from '../openedgeAblCommands'

const workspaceUri = getWorkspaceUri()

suite('proj3 - Extension Test Suite', () => {

	suiteSetup('proj3 - suiteSetup', () => suiteSetupCommon())

	setup('proj3 - beforeEach', async () => {
		await setRuntimes([{name: '11.7', path: '/psc/dlc_11.7'}, {name: oeVersion(), path: getDefaultDLC(), default: true}])
	})

	test('proj3.1 - target/ablunit.json file exists', () => {
		return runAllTests().then(() => {
			const ablunitJson = Uri.joinPath(workspaceUri, 'target', 'ablunit.json')
			const resultsXml = Uri.joinPath(workspaceUri, 'ablunit-output', 'results.xml')
			const listingsDir = Uri.joinPath(workspaceUri, 'target', 'listings')

			assert.fileExists(ablunitJson)
			assert.fileExists(resultsXml)
			assert.dirExists(listingsDir)
			return
		}, (e) => { throw e })
	})

})
