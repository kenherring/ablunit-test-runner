import { Selection, Uri, commands, window } from 'vscode'
import { assert, deleteTestFiles, getTestCount, getWorkspaceUri, log, runAllTests, sleep, suiteSetupCommon, updateConfig } from '../testCommon'

const workspaceUri = getWorkspaceUri()

suite('proj1 - Extension Test Suite', () => {

	suiteSetup('proj1 - suiteSetup', (done) => {
		suiteSetupCommon().then(() => { done() }, (e) => { done(e) })
	})

	function cleanBeforeAndAfter () {
		deleteTestFiles()
		log.info('cleanBeforeAndAfter.updateConfig')
		return updateConfig('ablunit.files.exclude', undefined).then(() => {
			log.info('setup.updateConfig.then()')
		}, (e) => {
			log.error('setup.cleanBeforeAndAfter() error! e=' + e)
			throw e
		})
	}

	setup((done) => {
		cleanBeforeAndAfter().then(() => { done() }, (e) => { done(e) })
	})
	// setup(async () => {
	// 	return cleanBeforeAndAfter().then(() => { log.info('before each promise complete') })
	// })

	suiteTeardown((done) => {
		cleanBeforeAndAfter().then(() => { done() }, (e) => { done(e) })
	})

	setup('proj1 - setup-2',  () => {
		log.info('setup-2')
	})

	test('proj1.1 - output files exist 1 - compile error', async () => {
		const ablunitJson = Uri.joinPath(workspaceUri, 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceUri, 'results.xml')
		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		assert.notFileExists(ablunitJson)
		assert.notFileExists(resultsXml)

		await runAllTests(false).then(() => {
			// assert.fail('expected runAllTests to throw error, but no error was caught')
		}, (e) => {
			log.info('Error caught and ignored: e=' + e)
		})


		// Different behavior on Windows/WSL and Unix
		// Unix does not create the results.xml file while Windows/WSL does...
		if (process.platform === 'win32' || process.env['WSL_DISTRO_NAME'] !== undefined) {
			assert.fileExists(resultsXml)
		} else {
			assert.notFileExists(resultsXml)
		}
		assert.fileExists(ablunitJson)
		assert.notFileExists(resultsJson)
	})

	test('proj1.2 - output files exist 2 - exclude compileError.p', (done) => {
		log.info('updating config...')
		updateConfig('ablunit.files.exclude', [ '.builder/**', 'compileError.p' ])
			.then(() => {
				log.info('running tests...')
				return runAllTests()
			}).then(() => {
				log.info('getTestCount...')
				return getTestCount(Uri.joinPath(workspaceUri, 'results.json'))
			}).then((testCount) => {
				log.info('asserting test count...')
				assert.equal(testCount, 12)
				done()
			}, (e) => {
				log.info('runAllTests failed!')
				throw e
			})
	})

	test('proj1.3 - output files exist 3 - exclude compileError.p as string', async () => {
		// this isn't officially supported and won't syntac check in the settings.json file(s), but it works
		await updateConfig('ablunit.files.exclude', 'compileError.p')
		await runAllTests()

		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		const testCount = await getTestCount(resultsJson)
		assert.equal(testCount, 12)
	})

	test('proj1.4 - run test case in file', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'procedureTest.p'))
		await sleep(200)
		await commands.executeCommand('testing.runCurrentFile')

		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		const testCount: number = await getTestCount(resultsJson)
		const pass = await getTestCount(resultsJson, 'pass')
		const fail = await getTestCount(resultsJson, 'fail')
		const error = await getTestCount(resultsJson, 'error')
		assert.equal(6, testCount, 'test count')
		assert.equal(2, pass, 'pass count')
		assert.equal(2, fail, 'fail count')
		assert.equal(2, error, 'error count')
	})

	test('proj1.5 - run test case at cursor', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'procedureTest.p'))
		if(window.activeTextEditor) {
			window.activeTextEditor.selection = new Selection(21, 0, 21, 0)
		} else {
			assert.fail('vscode.window.activeTextEditor is undefined')
		}
		await commands.executeCommand('testing.runAtCursor')

		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		const testCount = await getTestCount(resultsJson)
		const pass = await getTestCount(resultsJson, 'pass')
		const fail = await getTestCount(resultsJson, 'fail')
		const error = await getTestCount(resultsJson, 'error')
		assert.equal(1, testCount)
		assert.equal(1, pass)
		assert.equal(0, fail)
		assert.equal(0, error)
	})

})
