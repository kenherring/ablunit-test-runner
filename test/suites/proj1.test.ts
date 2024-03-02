import { ConfigurationTarget } from 'vscode'
import { assert, deleteTestFiles, getTestCount, getWorkspaceUri, log, runAllTests, suiteSetupCommon, updateConfig, setFilesExcludePattern, workspace, Uri, commands, window, Selection, newTruePromise, isoDate, extensions, getWorkspaceFolders, sleep2 } from '../testCommon'
import { readFileSync } from 'fs'
log.info('LOADING ' + __filename)

const ablunitConfig: {
	files: {
		exclude?: string[] | string | undefined
	}
} = { files: {}}

suite('proj1Suite', () => {

	suiteSetup('proj1 - suiteSetup', suiteSetupCommon)

	suiteSetup('proj1 - suiteSetup 2', () => {

		log.info(isoDate() + ' [proj1 suiteSetup 2.1]')
		log.info(isoDate() + ' [proj1 suiteSetup 2.2] workspaceConfig=' + workspace.getConfiguration('ablunit', getWorkspaceFolders()[0]).get('files.exclude'))
		log.info(isoDate() + ' [proj1 suiteSetup 2.3] workspaceConfig=' + JSON.stringify(workspace.getConfiguration('ablunit', getWorkspaceFolders()[0]).inspect('files.exclude')))
		let currentValue = workspace.getConfiguration('ablunit', getWorkspaceFolders()[0]).get('files.exclude')
		log.info(isoDate() + ' [proj1 suiteSetup2.3-1]  currentValue=' + currentValue)
		const currentValue2 = workspace.getConfiguration('ablunit', Uri.joinPath(getWorkspaceFolders()[0].uri, '.vscode', 'settings.json')).get('files.exclude')
		log.info(isoDate() + ' [proj1 suiteSetup2.3-2] currentValue2=' + currentValue2)

		const defaultValue = workspace.getConfiguration('ablunit').inspect('file.exclude')?.defaultValue
		log.info(isoDate() + ' [proj1 suiteSteup 3-5] defaultValue=' + JSON.stringify(defaultValue))

		if (JSON.stringify(defaultValue) === JSON.stringify(currentValue)) {
			currentValue = undefined
		}

		if (! (Array.isArray(currentValue) || typeof currentValue === 'string' || currentValue === undefined)) {
			throw new Error('Invalid currentValue: ' + currentValue)
		}
		if (JSON.stringify(currentValue) !== JSON.stringify(ablunitConfig.files.exclude)) {
			log.info(isoDate() + ' [proj1 suiteSetup2.4] currentValue=' + currentValue)
			ablunitConfig.files.exclude = currentValue
			log.info(isoDate() + ' [proj1 suiteSetup2.5]')
		}
		log.info(isoDate() + ' [proj1 suiteSetup 2.6] initialFilesExclude=' + JSON.stringify(ablunitConfig.files.exclude))
		log.info(isoDate() + ' [proj1 suiteSetup 2.7] workspaceConfig=' + workspace.getConfiguration('ablunit', getWorkspaceFolders()[0]).get('files.exclude'))
		return true
	})

	teardown('proj1 - teardown', () => {
		log.info(isoDate() + ' [proj1 teardown 1]')
		const conf = workspace.getConfiguration('ablunit.files')
		const defaultValue = conf.inspect('exclude')?.defaultValue
		const currentValue = conf.get('exclude')
		log.info(isoDate() + ' [proj1 teardown 2] defaultValue=' + JSON.stringify(defaultValue))
		log.info(isoDate() + ' [proj1 teardown 2] currentValue=' + JSON.stringify(currentValue))
		log.info(isoDate() + ' [proj1 teardown 3] initialFilesExclude=' + JSON.stringify(ablunitConfig.files.exclude))
		if (JSON.stringify(currentValue) !== JSON.stringify(ablunitConfig.files.exclude)) {
			log.info(isoDate() + ' [proj1 teardown 4] files.exclude=' + JSON.stringify(ablunitConfig.files.exclude))

			return workspace.getConfiguration('ablunit.files').update('exclude', ablunitConfig.files.exclude).then(() => {
				log.info(isoDate() + ' [proj1 teardown 5] ablunit.files.exclude set!')
			}, (e) => {
				log.error(isoDate() + ' [proj1 teardown 6] e=' + e)
			})
		}
		log.info(isoDate() + ' [proj1 teardown 7] complete!')
	})

	test('proj1.0A setFilesExcludePattern - test run fail', () => {
		log.info('proj1.0A-1')
		try {
			log.info('proj1.0A-2')
			assert.throws(async () => { await runAllTests(true, 'proj1,0A') })
			log.info('proj1.0A-3')
			// await assert.throws(() => runAllTests())
			// return assert.throws() => runAllTests())
			assert.fail('Error not caught')
		} catch (e) {
			log.info('proj1.0A-4')
			assert.assert(e)
			log.info('proj1.0A-5')
		}
		log.info('proj1.0A-6')
	})

	test('proj1.0B setFilesExcludePattern - test run fail', () => {
		try {
			assert.throws(async () =>  { await runAllTests(true, 'proj1.0B') })
			// await assert.throws(() => runAllTests())
			// return assert.throws() => runAllTests())
			assert.fail('Error not caught')
		} catch (e) {
			assert.assert(e)
		}
	})

	test('proj1.1 setFilesExcludePattern - test run pass', async () => {
		try {
			log.info(isoDate() + ' [proj1.3-1] workspaceFolder=' + workspace.workspaceFolders?.[0].uri.fsPath)
			await workspace.getConfiguration('ablunit.files').update('exclude', [ '.builder/**', '.pct/**', 'compileError.p' ]).then(() => {
				log.info(isoDate() + ' [proj1.3-2] ablunit.files.include' + workspace.getConfiguration('ablunit.files').get('include'))
				log.info(isoDate() + ' [proj1.3-2] ablunit.files.exclude' + workspace.getConfiguration('ablunit.files').get('exclude'))
				// return sleep2(100, 'sleep-1')
			// }).then(async () => { return sleep2(100, 'sleep-2') })
			})
			// await sleep2(100, 'sleep-3')
			log.info(isoDate() + ' [proj1.3-3]')
			await assert.doesNotThrowAsync(async () => { await runAllTests(true, 'proj1.1') })
			log.info(isoDate() + ' [proj1.3-4]')
			// return assert.doesNotThrowAsync(() => runAllTests())
		} catch (e) {
			log.info(isoDate() + ' [proj1.3-4]')
			assert.fail('Caught error unexpectedly! e=' + e)
			log.info(isoDate() + ' [proj1.3-5]')
		}
		log.info(isoDate() + ' [proj1.3-6]')
	})


	// test('proj1.0 setFilesExcludePattern - test run fail', async () => {
	// 	log.info('[proj1.0-1]')
	// 	await assert.throwsAsync(() => runAllTests())
	// 	log.info('[proj1.0-2]')
	// })

	// test('proj1.1 setFilesExcludePattern - test run fail', async () => {
	// 	log.info('[proj1.1-1')
	// 	let caughtErr = false
	// 	log.info('[proj1.1-2')
	// 	await runAllTests().catch((e) => {
	// 		log.debug('[proj1.1] e=' + e)
	// 		caughtErr = true
	// 	})
	// 	log.info('[proj1.1-6')
	// 	if (!caughtErr) { assert.fail('Error not caught') }
	// 	log.info('[proj1.1-7')
	// 	assert.ok(true)
	// 	log.info('[proj1.1-8')
	// })

	// test('proj1.2 setFilesExcludePattern - test run fail', async () => {
	// 	log.info('[proj1.2-1')
	// 	await runAllTests().then(() => {
	// 		log.info('[proj1.2-2')
	// 		assert.fail('Error not caught')
	// 		log.info('[proj1.2-3')
	// 	}, (e) => {
	// 		log.info('[proj1.2-4')
	// 		assert.ok(e)
	// 		log.info('[proj1.2-5')
	// 	})
	// 	log.info('[proj1.2-5')
	// })

	// test('proj1.3 setFilesExcludePattern - test run fail', async () => {
	// 	log.info('[proj1.3-1]')
	// 	const r = await runAllTests().then((r) => {
	// 		log.info('[proj1.3-2] r=' + r)
	// 		throw new Error('Error not caught - then() executured unexpectedly!')
	// 	}, (e) => {
	// 		log.info('[proj1.3-3] e=' + e)
	// 		return true
	// 		// return false
	// 	})
	// 	log.info('[proj1.3-4] r=' + r)
	// 	if (!r) { assert.fail('Error not caught!') }
	// })

	// test('proj1.4 setFilesExcludePattern - test run pass', async () => {
	// 	await workspace.getConfiguration('ablunit.files').update('exclude', [ '**/compileError.p' ]).then(() => {
	// 		log.info(isoDate() + ' [proj1.3-1] workspaceFolder=' + workspace.workspaceFolders?.[0].uri.fsPath)
	// 	})
	// 	await assert.doesNotThrowAsync(() => runAllTests())
	// 	// return assert.doesNotThrowAsync(() => runAllTests())
	// })

	// test('proj1.5 setFilesExcludePattern - test run pass', async () => {
	// 	await workspace.getConfiguration('ablunit.files').update('exclude', [ '**/compileError.p' ])
	// 	return runAllTests()
	// })

	// test('proj1.6 setFilesExcludePattern - test run pass', async () => {
	// 	return workspace.getConfiguration('ablunit.files').update('exclude', [ '**/compileError.p' ]).then(() => {
	// 		return runAllTests()
	// 	})
	// })

	// test('proj1.7 setFilesExcludePattern - test run pass', () => {
	// 	return workspace.getConfiguration('ablunit.files').update('exclude', [ '**/compileError.p' ]).then(() => {
	// 		return runAllTests()
	// 	})
	// })

	// test('proj1.8 setFilesExcludePattern - test run pass', async () => {
	// test('proj1.8 setFilesExcludePattern - test run pass', async () => {
	// 	log.info(isoDate() + ' [proj1.8-1] workspaceFolder=' + workspace.workspaceFolders?.[0].uri.fsPath)
	// 	await workspace.getConfiguration('ablunit.files').update('exclude', [ '**/compileError.p' ])
	// 		.then(() => {
	// 			log.info(isoDate() + ' [proj1.8-2] then ' + workspace.getConfiguration('ablunit.files').get('exclude'))
	// 			return runAllTests()
	// 		}).then(() => {
	// 			log.info(isoDate() + ' [proj1.8-2] catch ' + workspace.getConfiguration('ablunit.files').get('exclude'))
	// 			assert.assert(true)
	// 		})
	// 	log.info(isoDate() + ' [proj1.8-1] success!')
	// })

	// test('proj1.9A setFilesExcludePattern - set ablunit.files.exclude', async () => {
	// 	log.info(isoDate() + ' [proj1.9A-1]')
	// 	await workspace.getConfiguration('ablunit').update('files.exclude', [ '**/compileError.p' ])
	// 	log.info(isoDate() + ' [proj1.9A-2]')
	// })

	// test('proj1.9B validateTearDown', () => {
	// 	// must run after a test that changes the files.exclude setting, such as proj1.9A
	// 	log.info(isoDate() + ' [proj1.9B-1]')
	// 	const defaultValue = workspace.getConfiguration('ablunit').inspect('files.exclude')?.defaultValue
	// 	log.info(isoDate() + ' [proj1.9B-2] defaultValue=' + JSON.stringify(defaultValue))
	// 	const currentValue = workspace.getConfiguration('ablunit').get('files.exclude')
	// 	log.info(isoDate() + ' [proj1.9B-3] currentValue=' + JSON.stringify(currentValue))
	// 	// assert.equal(defaultValue, currentValue)
	// 	// assert.equal(defaultValue, currentValue)
	// 	assert.deepEqual(defaultValue, currentValue)
	// 	log.info(isoDate() + ' [proj1.9B-4]')
	// 	const settingsJson = readFileSync(Uri.joinPath(getWorkspaceUri(), '.vscode', 'settings.json').fsPath, 'utf8')
	// 	log.info(isoDate() + ' [proj1.9B-5] settingsJson=' + JSON.stringify(settingsJson))
	// 	assert.assert(!settingsJson.includes('"ablunit.files.exclude": [".builder/**",".pct/**"]'), '"ablunit.file.exclude" should be undefined in .vscode/settings.json')
	// 	log.info(isoDate() + ' [proj1.9B-6]')
	// 	// assert.ok(settingsJson.includes('"ablunit.files.exclude": [".builder/**",".pct/**"]'))
	// 	log.info(isoDate() + ' [proj1.9B-7]')
	// })

	// test('proj1.10 await conf.update .update', async () => {
	// 	log.info(isoDate() + ' [proj1.0-1] workspaceFolder=' + workspace.workspaceFolders?.[0].uri.fsPath)
	// 	const conf = workspace.getConfiguration('ablunit')
	// 	log.info(isoDate() + ' [proj1.0-2] conf=' + JSON.stringify(conf))
	// 	await conf.update('files.exclude', '**/compileError.p')
	// 	log.info(isoDate() + ' [proj1.0-3] workspaceFolder=' + workspace.workspaceFolders?.[0].uri.fsPath)
	// 	await runAllTests()
	// 	log.info(isoDate() + ' [proj1.0-4]')
	// })

	// test('proj1.11 await conf.update .update', async () => {
	// 	log.info(isoDate() + ' [proj1.0-1] workspaceFolder=' + workspace.workspaceFolders?.[0].uri.fsPath)
	// 	const conf = workspace.getConfiguration('ablunit')
	// 	log.info(isoDate() + ' [proj1.0-2] conf=' + JSON.stringify(conf))
	// 	try {
	// 		log.info(isoDate() + ' [proj1.0-3]')
	// 		await conf.update('files.exclude', undefined)
	// 		log.info(isoDate() + ' [proj1.0-4]')
	// 	} catch (e) {
	// 		log.info(isoDate() + ' [proj1-5] e=' + e)
	// 		assert.fail('Error: ' + e)
	// 	}
	// 	log.info(isoDate() + ' [proj1.0-6] workspaceFolder=' + workspace.workspaceFolders?.[0].uri.fsPath)
	// 	await runAllTests()
	// 	log.info(isoDate() + ' [proj1.0-7]')
	// })


	// test('proj1.12 - output files exist 2 - exclude compileError.p', async () => {
	// 	await workspace.getConfiguration('ablunit').update('files.exclude', [ '.builder/**', 'compileError.p' ]).then(() => {
	// 		return runAllTests()
	// 	})
	// 	// await updateConfig('ablunit.files.exclude', [ '.builder/**', 'compileError.p' ])
	// 	// await runAllTests()

	// 	const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
	// 	const testCount = await getTestCount(resultsJson)
	// 	assert.equal(testCount, 12)
	// })

	// test('proj1.13 - output files exist 3 - exclude compileError.p as string', async () => {
	// 	// this isn't officially supported and won't syntac check in the settings.json file(s), but it works
	// 	await updateConfig('ablunit.files.exclude', 'compileError.p')
	// 	await runAllTests()

	// 	const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
	// 	const testCount = await getTestCount(resultsJson)
	// 	assert.equal(testCount, 12)
	// })

	// test('proj1.14 - run test case in file', async () => {
	// 	await commands.executeCommand('vscode.open', Uri.joinPath(getWorkspaceUri(), 'procedureTest.p'))
	// 	await commands.executeCommand('testing.runCurrentFile')

	// 	const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
	// 	const testCount: number = await getTestCount(resultsJson)
	// 	const pass = await getTestCount(resultsJson, 'pass')
	// 	const fail = await getTestCount(resultsJson, 'fail')
	// 	const error = await getTestCount(resultsJson, 'error')
	// 	assert.equal(6, testCount, 'test count')
	// 	assert.equal(2, pass, 'pass count')
	// 	assert.equal(2, fail, 'fail count')
	// 	assert.equal(2, error, 'error count')
	// })

	// test('proj1.15 - run test case at cursor', async () => {
	// 	await commands.executeCommand('vscode.open', Uri.joinPath(getWorkspaceUri(), 'procedureTest.p'))
	// 	if(window.activeTextEditor) {
	// 		window.activeTextEditor.selection = new Selection(21, 0, 21, 0)
	// 	} else {
	// 		assert.fail('vscode.window.activeTextEditor is undefined')
	// 	}
	// 	await commands.executeCommand('testing.runAtCursor')

	// 	const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
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
