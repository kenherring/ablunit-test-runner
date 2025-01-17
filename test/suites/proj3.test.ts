import { assert, getDefaultDLC, getWorkspaceUri, oeVersion, runAllTests, runAllTestsWithCoverage, setRuntimes, suiteSetupCommon, Uri } from '../testCommon'

const workspaceUri = getWorkspaceUri()

suite('proj3 - Extension Test Suite', () => {

	suiteSetup('proj3 - suiteSetup', async () => {
		await suiteSetupCommon()
	})

	setup('proj3 - beforeEach', async () => {
		await setRuntimes([{name: '11.7', path: '/psc/dlc_11.7'}, {name: oeVersion(), path: getDefaultDLC(), default: true}])
		return
	})

	test('proj3.1 - target/ablunit.json file exists', () => {
		const prom = runAllTests().then(() => {
			const ablunitJson = Uri.joinPath(workspaceUri, 'target', 'ablunit.json')
			const resultsXml = Uri.joinPath(workspaceUri, 'ablunit-output', 'results.xml')
			const listingsDir = Uri.joinPath(workspaceUri, 'target', 'listings')

			assert.fileExists(ablunitJson)
			assert.fileExists(resultsXml)
			assert.notDirExists(listingsDir)
			return
		}, (e: unknown) => { throw e })
		return prom
	})

	test('proj3.2 - target/ablunit.json file exists w/ coverage', () => {
		return runAllTestsWithCoverage().then(() => {
			const ablunitJson = Uri.joinPath(workspaceUri, 'target', 'ablunit.json')
			const resultsXml = Uri.joinPath(workspaceUri, 'ablunit-output', 'results.xml')
			const listingsDir = Uri.joinPath(workspaceUri, 'target', 'listings')

			assert.fileExists(ablunitJson)
			assert.fileExists(resultsXml)
			assert.dirExists(listingsDir)
			return
		}, (e: unknown) => { throw e })
	})

})
