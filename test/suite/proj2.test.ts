import { before } from 'mocha'
import { Uri, commands } from 'vscode'
import { assert, getResults, getWorkspaceUri, log, refreshData, runAllTests, sleep, waitForExtensionActive } from 'testCommon'


const projName = 'proj2'
const workspaceUri = getWorkspaceUri()

suite(projName + ' - Extension Test Suite', () => {

	before(projName + ' - before', async () => {
		await waitForExtensionActive()
	})

	test(projName + '.1 - temp/ablunit.json file exists', async () => {
		await runAllTests()

		const ablunitJson = Uri.joinPath(workspaceUri, 'temp', 'ablunit.json')
		assert.fileExists(ablunitJson)
	})

	test(projName + '.2 - call stack', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'src/classes/testClass2.cls'))
		await sleep(200)
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

	test(projName + '.3 - run current test suite', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'src/testSuite.cls'))
		await sleep(200)
		await commands.executeCommand('testing.runCurrentFile')
		await refreshData()
		const recentResults = await getResults()

		const res = recentResults[0].ablResults?.resultsJson[0]
		if (!res) {
			assert.fail('res is null')
		} else {
			assert.equal(1, res.errors, 'res.errors should be 0')
			assert.equal(3, res.failures, 'res.failures should be 0')
			assert.equal(5, res.passed, 'res.passed should be 0')
			assert.equal(9, res.tests, 'res.tests should be 1')
		}
	})

})
