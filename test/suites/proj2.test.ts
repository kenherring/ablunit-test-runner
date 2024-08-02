import { Uri, commands } from 'vscode'
import { assert, deleteTestFiles, getResults, getWorkspaceUri, log, refreshData, runAllTests, sleep, suiteSetupCommon } from '../testCommon'

const workspaceUri = getWorkspaceUri()

suite('proj2 - Extension Test Suite', () => {

	suiteSetup('proj2 - before', async () => {
		await suiteSetupCommon()
		return
	})

	test('proj2.1 - temp/ablunit.json file exists', async () => {
		await runAllTests()

		const ablunitJson = Uri.joinPath(workspaceUri, 'temp', 'ablunit.json')
		assert.fileExists(ablunitJson)
	})

	test('proj2.2 - call stack', () => {
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

	test('proj2.3 - run current test suite', async (done) => {
		const recentResults = await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'src/testSuite.cls'))
			.then(() => sleep(200))
			.then(() => commands.executeCommand('testing.runCurrentFile'))
			.then(() => getResults(), (e) => { throw e })

		const res = recentResults[0].ablResults?.resultsJson[0]
		if (!res) {
			assert.fail('res is null')
		} else {
			log.info('res.errors=' + res.errors + ', res.failures=' + res.failures + ', res.passed=' + res.passed + ', res.tests=' + res.tests)
			assert.equal(1, res.errors, 'res.errors should be 0')
			assert.equal(3, res.failures, 'res.failures should be 0')
			assert.equal(5, res.passed, 'res.passed should be 0')
			assert.equal(9, res.tests, 'res.tests should be 1')
		}
		done()
	})

})
