import { Uri, assert, commands, getResults, installExtension, log, refreshData, runAllTests, sleep, waitForExtensionActive, workspaceUri } from '../testCommon'

export default suite('proj2Suite', () => {

	suiteSetup('proj2 - suiteSetup', async () => {
		await waitForExtensionActive()
		await installExtension('riversidesoftware.openedge-abl-lsp')
	})

	test('proj2.1 - temp/ablunit.json file exists', async () => {
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri(), 'temp', 'ablunit.json')
		assert.fileExists(ablunitJson)
	})

	test('proj2.2 - call stack', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri(), 'src/classes/testClass2.cls'))
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

	test('proj2.3 - run current test suite', async () =>{
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri(), 'src/testSuite.cls'))
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
