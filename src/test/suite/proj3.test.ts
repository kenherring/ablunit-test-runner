import { before } from 'mocha'
import { Uri } from 'vscode'
import { assert, getDefaultDLC, getWorkspaceUri, runAllTests, setRuntimes, waitForExtensionActive } from '../testCommon'

const projName = 'proj3'
const workspaceUri = getWorkspaceUri()

before(async () => {
	await waitForExtensionActive()
	await setRuntimes([{name: '11.7', path: '/psc/dlc_11.7'}, {name: '12.2', path: getDefaultDLC(), default: true}])
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - target/ablunit.json file exists', async () => {
		await runAllTests()

		const ablunitJson = Uri.joinPath(workspaceUri, 'target', 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceUri, 'ablunit-output', 'results.xml')
		const listingsDir = Uri.joinPath(workspaceUri, 'target', 'listings')

		assert.fileExists(ablunitJson)
		assert.fileExists(resultsXml)
		assert.dirExists(listingsDir)
	})

})
