import { Uri, assert, getDefaultDLC, getWorkspaceUri, installExtension, runAllTests, setRuntimes, waitForExtensionActive } from '../testCommon'

export default suite('proj3Suite', () => {

	suiteSetup('proj3 - suiteSetup', async () => {
		await waitForExtensionActive()
		await installExtension('riversidesoftware.openedge-abl-lsp')
		await setRuntimes([{name: '11.7', path: '/psc/dlc_11.7'}, {name: '12.2', path: getDefaultDLC(), default: true}])
	})

	test('proj3.1 - target/ablunit.json file exists', async () => {
		await runAllTests()

		const ablunitJson = Uri.joinPath(getWorkspaceUri(), 'target', 'ablunit.json')
		const resultsXml = Uri.joinPath(getWorkspaceUri(), 'ablunit-output', 'results.xml')
		const listingsDir = Uri.joinPath(getWorkspaceUri(), 'target', 'listings')

		assert.fileExists(ablunitJson)
		assert.fileExists(resultsXml)
		assert.dirExists(listingsDir)
	})

})
