import { Uri } from 'vscode'
import { assert, getDefaultDLC, getWorkspaceUri, log, runAllTests, setRuntimes, waitForExtensionActive } from '../testCommon'

const projName = 'proj3'
const workspaceUri = getWorkspaceUri()

suite('proj3 - Extension Test Suite', () => {

	suiteSetup('proj3 - before', async () => {
		return waitForExtensionActive()
	})

	setup('proj3 - setup', async () => {
		await setRuntimes([{name: '11.7', path: '/psc/dlc_11.7'}, {name: '12.2', path: getDefaultDLC(), default: true}]).then()
		log.info('setup complete!')
	})

	test('proj3.1 - target/ablunit.json file exists', async () => {
		return runAllTests().then(() => {
			const ablunitJson = Uri.joinPath(workspaceUri, 'target', 'ablunit.json')
			const resultsXml = Uri.joinPath(workspaceUri, 'ablunit-output', 'results.xml')
			const listingsDir = Uri.joinPath(workspaceUri, 'target', 'listings')

			assert.fileExists(ablunitJson)
			assert.fileExists(resultsXml)
			assert.dirExists(listingsDir)
		})
	})

})
