import { assert, FileUtils, getDefaultDLC, getRcodeCount, getWorkspaceUri, log, oeVersion, rebuildAblProject, runAllTests, runAllTestsWithCoverage, setRuntimes, suiteSetupCommon, toUri, Uri } from '../testCommon'

const workspaceUri = getWorkspaceUri()

suite('proj3 - Extension Test Suite', () => {

	suiteSetup('proj3 - suiteSetup', async () => {
		await suiteSetupCommon()
	})

	setup('proj3 - beforeEach', async () => {
		FileUtils.deleteDir('target/listings')
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
			return true
		}, (e: unknown) => { throw e })
		return prom
	})

	test('proj3.2 - target/ablunit.json file exists w/ coverage', async () => {
		await runAllTestsWithCoverage()
		const rcodeCount = getRcodeCount()
		assert.greater(rcodeCount, 5)

		const ablunitJson = Uri.joinPath(workspaceUri, 'target', 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceUri, 'ablunit-output', 'results.xml')
		const listingsDir = Uri.joinPath(workspaceUri, 'target', 'listings')

		assert.fileExists(ablunitJson)
		assert.fileExists(resultsXml)
		assert.dirExists(listingsDir)

		// validate coverage lines when many profiles imported
		assert.coverageProcessingMethod(toUri('LotsOfTests.p').fsPath, 'rcode')
		assert.linesExecuted('LotsOfTests.p', [7, 8, 9])
		assert.linesExecuted('testProcedure.i', [8, 9, 10])
	})

})
