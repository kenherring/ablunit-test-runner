import { Selection, Uri, commands, window, workspace } from 'vscode'
import { assert, deleteTestFiles, getTestCount, getWorkspaceUri, log, runAllTests, sleep, toUri, updateConfig, waitForExtensionActive } from '../testCommon'


const workspaceUri = getWorkspaceUri()

suite('proj1 - Extension Test Suite', () => {

	suiteSetup('proj1 - before', () => {
		return waitForExtensionActive()
	})

	setup('proj1 - beforeEach', () => {
		log.info('setup-1')
		deleteTestFiles()
		log.info('setup-2')
		return updateConfig('ablunit.files.exclude', undefined)
			.then(() => { log.info('setup-3'); return }, (e) => { throw e })
	})

	suiteTeardown('proj1 - afterEach', () => {
		log.info('suiteTeardown-1')
		return updateConfig('ablunit.files.exclude', undefined)
			.then(() => { log.info('suiteTeardown-2'); return }, (e) => { throw e })
	})

	test('proj1.1 - output files exist 1 - compile error', () => {
		const ablunitJson = Uri.joinPath(workspaceUri, 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceUri, 'results.xml')
		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		assert.notFileExists(ablunitJson)
		assert.notFileExists(resultsXml)

		return runAllTests().then(() => {
			throw new Error('runAllTests should have thrown an error')
		}, (e: unknown) => {
			log.info('runAllTests error: ' + e)
			assert.fileExists(ablunitJson)
			if (process.platform === 'win32' || process.env['WSL_DISTRO_NAME'] !== undefined) {
				assert.fileExists(resultsXml)
			} else {
				assert.notFileExists(resultsXml)
			}
			assert.notFileExists(resultsJson)
		})
	})

	test('proj1.2 - output files exist 2 - exclude compileError.p', () => {
		return workspace.getConfiguration('ablunit').update('files.exclude', [ '.builder/**', 'compileError.p' ])
			.then(() => { return runAllTests() })
			.then(() => {
				assert.tests.count(12)
				log.info('proj1.2 complete!')
				return
			}, (e) => { throw e })
	})

	// test('proj1.3 - output files exist 3 - exclude compileError.p as string', async () => {
	// 	// this isn't officially supported and won't syntac check in the settings.json file(s), but it works
	// 	await updateConfig('ablunit.files.exclude', 'compileError.p')
	// 	await runAllTests()

	// 	const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
	// 	const testCount = await getTestCount(resultsJson)
	// 	assert.equal(testCount, 12)
	// })

	// test('proj1.4 - run test case in file', async () => {
	// 	await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'procedureTest.p'))
	// 	await sleep(200)
	// 	await commands.executeCommand('testing.runCurrentFile')

	// 	const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
	// 	const testCount: number = await getTestCount(resultsJson)
	// 	const pass = await getTestCount(resultsJson, 'pass')
	// 	const fail = await getTestCount(resultsJson, 'fail')
	// 	const error = await getTestCount(resultsJson, 'error')
	// 	assert.equal(6, testCount, 'test count')
	// 	assert.equal(2, pass, 'pass count')
	// 	assert.equal(2, fail, 'fail count')
	// 	assert.equal(2, error, 'error count')
	// })

	// test('proj1.5 - run test case at cursor', async () => {
	// 	await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'procedureTest.p'))
	// 	if(window.activeTextEditor) {
	// 		window.activeTextEditor.selection = new Selection(21, 0, 21, 0)
	// 	} else {
	// 		assert.fail('vscode.window.activeTextEditor is undefined')
	// 	}
	// 	await commands.executeCommand('testing.runAtCursor')

	// 	const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
	// 	const testCount = await getTestCount(resultsJson)
	// 	const pass = await getTestCount(resultsJson, 'pass')
	// 	const fail = await getTestCount(resultsJson, 'fail')
	// 	const error = await getTestCount(resultsJson, 'error')
	// 	assert.equal(1, testCount)
	// 	assert.equal(1, pass)
	// 	assert.equal(0, fail)
	// 	assert.equal(0, error)
	// })

})
