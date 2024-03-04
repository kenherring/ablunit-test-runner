import { assert, getResults, log, runAllTests, sleep2, suiteSetupCommon, toUri } from '../testCommon'

suite('workspace0Suite', () => {

	suiteSetup('workspace0 - suiteSetup', suiteSetupCommon)

	test('workspace0.1 - <workspaceFolder>/ablunit.json file exists', async () => {
		log.info('workspace0.1 - output files exist - 1')
		await sleep2(500)
		log.info('workspace0.1 - start')
		return runAllTests().then(async () => {
			log.info('getResults')
			return getResults().then((recentResults) => {
				log.info('ablunit.json = ' + recentResults[0].cfg.ablunitConfig.config_uri)
				assert.equal(recentResults[0].cfg.ablunitConfig.config_uri, toUri('ablunit.json'), 'ablunit.json path mismatch')
				assert.fileExists('ablunit.json', 'results.xml')
				assert.notFileExists('results.json')
				assert.notDirExists('listings')
				log.info('resuls done proj0.1')
				return true
			})
		})
	})

})
