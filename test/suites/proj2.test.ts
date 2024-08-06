import { assert, getResults, getWorkspaceUri, log, runAllTests, sleep, suiteSetupCommon, Uri, commands } from '../testCommon'

const workspaceUri = getWorkspaceUri()

suite('proj2 - Extension Test Suite', () => {

	suiteSetup('proj2 - before', async () => {
		await suiteSetupCommon()
	})

	test('proj2.1 - temp/ablunit.json file exists', async () => {
		await runAllTests().then(() => {
			const ablunitJson = Uri.joinPath(workspaceUri, 'temp', 'ablunit.json')
			assert.fileExists(ablunitJson)
		})
	})

	test.skip('proj2.2 - call stack', () => {
		return commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'src/classes/testClass2.cls'))
			.then(() => sleep(200))
			.then(() => commands.executeCommand('testing.runCurrentFile'))
			.then(() => sleep(200))
			.then(() => getResults())
			.then((recentResults) => {
				log.info('recentResults = ' + recentResults + ' ' + recentResults.length)
				const tc = recentResults[0].ablResults?.resultsJson[0].testsuite?.[0].testcases?.[0]
				const mdText = tc?.failure?.callstack.items[1].markdownText
				if (!mdText) {
					assert.fail('mdText is null')
				}
				if (mdText?.includes('testClass2.cls:file:///')) {
					assert.fail('mdText should be testClasse.cls:6')
				}
				return true
			})
	})

	test.skip('proj2.3 - run current test suite', async () => {
		const prom = commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'src/testSuite.cls'))
			.then(() => sleep(200))
			.then(() => commands.executeCommand('testing.runCurrentFile'))
			.then(() => getResults(), (e) => { throw e })
		const recentResults = await prom

		const res = recentResults[0].ablResults?.resultsJson[0]
		if (!res) {
			assert.fail('res is null')
		} else {
			log.info('res.errors=' + res.errors + ', res.failures=' + res.failures + ', res.passed=' + res.passed + ', res.tests=' + res.tests)
			assert.equal(1, res.errors, 'res.errors should be 1 but got ' + res.errors)
			assert.equal(3, res.failures, 'res.failures should be 3 but got ' + res.failures)
			assert.equal(5, res.passed, 'res.passed should be 5 but got ' + res.passed)
			assert.equal(9, res.tests, 'res.tests should be 9 but got ' + res.tests)
		}
		return
	})

})
