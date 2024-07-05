import { Uri, assert, getDefaultDLC, getWorkspaceUri, isoDate, log, runAllTests, suiteSetupCommon, suiteTeardownCommon, workspace } from '../testCommon'

suite('proj3Suite', () => {

	suiteSetup('proj3 - suiteSetup', suiteSetupCommon)
	suiteTeardown('proj3 - suiteTeardown', suiteTeardownCommon)

	test('proj3.1 - target/ablunit.json file exists', async () => {
		log.info(isoDate() + ' proj3.1 - 1.1')
		const conf = workspace.getConfiguration('abl')
		log.info(isoDate() + ' proj3.1 - 1.2 conf=' + JSON.stringify(conf))
		await conf.update('configuration.runtimes', [{name: '11.7', path: '/psc/dlc_11.7'}, {name: '12.2', path: getDefaultDLC(), default: true}]).then(
			() => { log.info(isoDate() + ' proj3.1 - 1.3') },
			(e) => { log.error(isoDate() + ' proj3.1 - 1.4 e=' + e) }
		)
		log.info(isoDate() + ' proj3.1 - 1.5')
		await runAllTests(true)

		log.info(isoDate() + ' proj3.1 - 2')
		const ablunitJson = Uri.joinPath(getWorkspaceUri(), 'target', 'ablunit.json')
		const resultsXml = Uri.joinPath(getWorkspaceUri(), 'ablunit-output', 'results.xml')
		const listingsDir = Uri.joinPath(getWorkspaceUri(), 'target', 'listings')

		log.info(isoDate() + ' proj3.1 - 10')
		assert.fileExists(ablunitJson)
		log.info(isoDate() + ' proj3.1 - 11')
		assert.fileExists(resultsXml)
		log.info(isoDate() + ' proj3.1 - 12')
		assert.dirExists(listingsDir)
		log.info(isoDate() + ' proj3.1 - 13')
	})

})
