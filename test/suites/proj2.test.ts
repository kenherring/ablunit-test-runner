import { Uri, assert, commands, getResults, log, refreshData, runAllTests, suiteSetupCommon, workspaceUri } from '../testCommon'

suite('proj2Suite', () => {

	suiteSetup('proj2 - suiteSetup', suiteSetupCommon)

	test('proj2.1 - temp/ablunit.json file exists', async () => {
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri(), 'temp', 'ablunit.json')
		assert.fileExists(ablunitJson)
	})

	test('proj2.2 - call stack', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri(), 'src/classes/testClass2.cls'))
		await commands.executeCommand('testing.runCurrentFile')
		await refreshData()
		const recentResults = await getResults()
		log.info('recentResults = ' + recentResults + ' ' + recentResults.length)

		const tc = recentResults[0].ablResults?.resultsJson[0].testsuite?.[0].testcases?.[0]
		const mdText = tc?.failure?.callstack.items[1].markdownText
		if (!mdText) {
			assert.fail('mdText is null')
		}
		if (mdText?.includes('testClass2.cls:file:///')) {
			assert.fail('mdText should be testClasse.cls:6')
		}
	})

	test('proj2.3 - run current test suite', async () =>{
		log.info('proj2.3-1')
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri(), 'src/testSuite.cls'))
		log.info('proj2.3-2')
		await commands.executeCommand('testing.runCurrentFile')
		log.info('proj2.3-3')
		await refreshData()
		log.info('proj2.3-4')
		const recentResults = await getResults()
		log.info('proj2.3-5')

		const res = recentResults[0].ablResults?.resultsJson[0]
		log.info('proj2.3-6')
		if (!res) {
			log.info('proj2.3-7')
			assert.fail('res is null')
			log.info('proj2.3-8')
		} else {
			log.info('proj2.3-9')
			assert.equal(1, res.errors, 'res.errors should be 0')
			log.info('proj2.3-10')
			assert.equal(3, res.failures, 'res.failures should be 0')
			log.info('proj2.3-11')
			assert.equal(5, res.passed, 'res.passed should be 0')
			log.info('proj2.3-12')
			assert.equal(9, res.tests, 'res.tests should be 1')
			log.info('proj2.3-13')
		}
		log.info('proj2.3-14')
	})

})
