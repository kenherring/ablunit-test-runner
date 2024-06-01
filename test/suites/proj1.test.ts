// import { Selection, Uri, commands, window, workspace } from 'vscode'
// import { assert, deleteTestFiles, getTestCount, getWorkspaceUri, log, runAllTests, sleep, toUri, updateConfig, waitForExtensionActive } from '../testCommon'
// import { ReadableStreamDefaultController } from 'stream/web'

// import { before, beforeEach } from 'mocha'
import { Uri, assert, deleteTestFiles, getWorkspaceUri, log, runAllTests, waitForExtensionActive, workspace } from '../testCommon'

const workspaceUri = getWorkspaceUri()

suite('proj1 - Extension Test Suite', () => {

	suiteSetup('proj1 - before', () => {
		return waitForExtensionActive()
			.then((r) => {
				log.info('end waitForExtensionActive (r=' + r + ')')
				return r
			}, (e) => {
				log.error('waitForExtensionActive error: ' + e)
				throw e
			})
	})

	// before('proj1 - before', async () => {
	suiteSetup('proj1 - before', async () => {
		const r = await waitForExtensionActive()
		log.info('end waitForExtensionActive (r=' + r + ')')
		return r
	})

	// setup('proj1 - beforeEach', () => {
	// 	log.info('setup-1')
	// 	deleteTestFiles()
	// 	log.info('setup-2')
	// 	return updateConfig('ablunit.files.exclude', undefined)
	// 		.then(() => {
	// 			log.info('setup-3')
	// 			return true
	// 		}, (e) => { throw e })
	// })

	// setup('proj1 - beforeEach', (done) => {
	// 	log.info('setup-1')
	// 	deleteTestFiles()
	// 	log.info('setup-2')
	// 	// await updateConfig('ablunit.files.exclude', undefined)

	// 	// eslint-disable-next-line promise/catch-or-return
	// 	updateConfig('ablunit.files.exclude', undefined)
	// 		.then(() => {
	// 			log.info('setup-4 post-updateConfig')
	// 			setImmediate(() => { log.info('setup-4 setImmediate'); done() })
	// 			return
	// 		}, (e) => { throw e })
	// 		// .finally(() => { log.info('setup-4 done'); done(); ReadableStreamDefaultController })
	// 	log.info('setup-3')
	// 	// return Promise.resolve()
	// })



	// beforeEach('proj1 - beforeEach', async () => {
	setup('proj1 - beforeEach', async () => {
		log.info('setup-1')
		deleteTestFiles()
		log.info('setup-2')
		const prom = workspace.getConfiguration('ablunit').update('files.exclude', undefined)
		log.info('setup-3')
		await prom.then(() => { log.info('setup-4') }, () => { log.error('failed to update ablunit.files.exclude') })
		log.info('setup-5')
		// return
		// return updateConfig('ablunit.files.exclude', undefined)
		// 	.then((r) => { log.info('setup-3 (r=' + r + ')'); return }, (e) => { throw e })
		// 	// .then((r) => { log.info('setup-3 (r=' + r + ')'); return true }, (e) => { throw e })
		// 	// .then((r) => { log.info('setup-3 (r=' + r + ')'); return r }, (e) => { throw e })
	})

	// setup('proj1 - beforeEach', async () => {
	// 	log.info('setup-1')
	// 	deleteTestFiles()
	// 	log.info('setup-2')
	// 	const r = updateConfig('ablunit.files.exclude', undefined)
	// 		.then(() => {
	// 			log.info('setup-3')
	// 			return
	// 		}, (e) => { throw e })
	// 	log.info('setup-4 (r=' + r + ')')
	//  done()
	// })

	// suiteTeardown('proj1 - afterEach', () => {
	// 	log.info('suiteTeardown-1')
	// 	return updateConfig('ablunit.files.exclude', undefined)
	// 		.then((r) => { return r }, (e) => { throw e })
	// })

	test('proj1.1 - output files exist 1 - compile error', () => {
		const ablunitJson = Uri.joinPath(workspaceUri, 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceUri, 'results.xml')
		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		assert.notFileExists(ablunitJson)
		assert.notFileExists(resultsXml)

		return runAllTests()
			.then(() => {
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
				log.info('assert proj1.1 complete!')
			})
	})

	test('proj1.2 - output files exist 2 - exclude compileError.p', () => {
		return workspace.getConfiguration('ablunit').update('files.exclude', [ '.builder/**', 'compileError.p' ])
			.then(() => { return runAllTests() })
			.then(() => {
				assert.tests.count(12)
				log.info('proj1.2 complete!')
				return true
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
