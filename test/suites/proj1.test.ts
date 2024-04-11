import { assert, deleteTestFiles, getTestCount, getWorkspaceUri, log, runAllTests, suiteSetupCommon, setFilesExcludePattern, workspace, Uri, commands, window, Selection, newTruePromise, isoDate, extensions, getWorkspaceFolders, sleep2 } from '../testCommon'
import { readFileSync } from 'fs'
log.info('LOADING ' + __filename)

const ablunitConfig: {
	files: {
		exclude?: string[] | string | undefined
	}
} = { files: {}}

async function updateConfig (section: string, value: unknown) {
	log.info('updateConfig-1 update config starting... section=' + section + ' value=' + value)
	const sections = section.split('.')
	const firstSection = sections.shift()
	const otherSections = sections.join('.')
	log.info('firstSection=' + firstSection + ', otherSections=' + otherSections)
	await workspace.getConfiguration(firstSection).update(otherSections, [ '.builder/**', '.pct/**', 'compileError.p' ])
	log.info('[proj1 updateConfig] update config complete!')
}

async function teardownCommon () {
	const conf = workspace.getConfiguration('ablunit.files')
	const currentValue = conf.get('exclude')
	if (JSON.stringify(currentValue) !== JSON.stringify(ablunitConfig.files.exclude)) {

		return workspace.getConfiguration('ablunit.files').update('exclude', ablunitConfig.files.exclude).then(() => {
			log.debug(isoDate() + ' [proj1 suiteTeardown 5] ablunit.files.exclude reset!')
		}, (e) => {
			log.error(isoDate() + ' [proj1 suiteTeardown] e=' + e)
			throw e
		})
	}
	log.info(isoDate() + ' [proj1 suiteTeardown 7] complete!')
}

suite('proj1Suite', () => {

	suiteSetup('proj1 - suiteSetup', suiteSetupCommon)

	suiteSetup('proj1 - suiteSetup 2', () => {
		log.info(isoDate() + ' [proj1 suiteSetup 2.1]')
		let currentValue = workspace.getConfiguration('ablunit', getWorkspaceFolders()[0]).get('files.exclude')
		const defaultValue = workspace.getConfiguration('ablunit').inspect('files.exclude')?.defaultValue

		if (JSON.stringify(defaultValue) === JSON.stringify(currentValue)) {
			currentValue = undefined
		}

		if (! (Array.isArray(currentValue) || typeof currentValue === 'string' || currentValue === undefined)) {
			throw new Error('Invalid currentValue: ' + currentValue)
		}
		if (JSON.stringify(currentValue) !== JSON.stringify(ablunitConfig.files.exclude)) {
			log.info(isoDate() + ' [proj1 suiteSetup2.4] ablunit.files.exclude currentValue=' + currentValue)
			ablunitConfig.files.exclude = currentValue
		}
		log.info(isoDate() + ' [proj1 suiteSetup 2.6] initialFilesExclude=' + JSON.stringify(ablunitConfig.files.exclude))
		log.info(isoDate() + ' [proj1 suiteSetup 2.7] workspaceConfig=' + workspace.getConfiguration('ablunit', getWorkspaceFolders()[0]).get('files.exclude'))

		deleteTestFiles()
		return true
	})

	setup('proj1 - setup', () => {
		deleteTestFiles()
	})

	// suiteSetup('proj1 - suiteSetup 2', () => {
	// 	log.info(isoDate() + ' [proj1 suiteSetup 2.1]')
	// 	log.info(isoDate() + ' [proj1 suiteSetup 2.2] workspaceConfig=' + workspace.getConfiguration('ablunit', getWorkspaceFolders()[0]).get('files.exclude'))
	// 	log.info(isoDate() + ' [proj1 suiteSetup 2.3] workspaceConfig=' + JSON.stringify(workspace.getConfiguration('ablunit', getWorkspaceFolders()[0]).inspect('files.exclude')))
	// 	let currentValue = workspace.getConfiguration('ablunit', getWorkspaceFolders()[0]).get('files.exclude')
	// 	log.info(isoDate() + ' [proj1 suiteSetup2.3-1]  currentValue=' + currentValue)
	// 	const currentValue2 = workspace.getConfiguration('ablunit', Uri.joinPath(getWorkspaceFolders()[0].uri, '.vscode', 'settings.json')).get('files.exclude')
	// 	log.info(isoDate() + ' [proj1 suiteSetup2.3-2] currentValue2=' + currentValue2)

	// 	log.info(isoDate() + ' [proj1 suiteSetup 3-4] inspect=' + JSON.stringify(workspace.getConfiguration('ablunit').inspect('files.exclude')))
	// 	const defaultValue = workspace.getConfiguration('ablunit').inspect('files.exclude')?.defaultValue
	// 	log.info(isoDate() + ' [proj1 suiteSteup 3-5] defaultValue=' + JSON.stringify(defaultValue))
	// 	if (JSON.stringify(defaultValue) === JSON.stringify(currentValue)) {
	// 		currentValue = undefined
	// 	}

	// 	if (! (Array.isArray(currentValue) || typeof currentValue === 'string' || currentValue === undefined)) {
	// 		throw new Error('Invalid currentValue: ' + currentValue)
	// 	}
	// 	if (JSON.stringify(currentValue) !== JSON.stringify(ablunitConfig.files.exclude)) {
	// 		log.info(isoDate() + ' [proj1 suiteSetup2.4] currentValue=' + currentValue)
	// 		ablunitConfig.files.exclude = currentValue
	// 		log.info(isoDate() + ' [proj1 suiteSetup2.5]')
	// 	}
	// 	log.info(isoDate() + ' [proj1 suiteSetup 2.6] initialFilesExclude=' + JSON.stringify(ablunitConfig.files.exclude))
	// 	log.info(isoDate() + ' [proj1 suiteSetup 2.7] workspaceConfig=' + workspace.getConfiguration('ablunit', getWorkspaceFolders()[0]).get('files.exclude'))

	// 	deleteTestFiles()
	// 	return true
	// })

	teardown('proj1 - teardown', async () => {
		await teardownCommon()
		return
	})

	// suiteTeardown('proj1 - suiteTeardown', async () => {
	// 	return teardownCommon()
	// })

	test('proj1.0A CompileError - test run fail - await', async () => {
		log.info('proj1.0A-1')
		await assert.throwsAsync(async () => { await runAllTests(true, true, 'proj1.0A') }, 'failed to throw excetption')
		log.info('proj1.0A-2')
		return newTruePromise()
	})

	// @ignore
	// test('proj1.0B CompileError - test run fail - assert.catch', (done: Mocha.Done) => {
	// 	log.info('proj1.0B-1')
	// 	assert.throws(async () => {
	// 		log.info('proj1.0B-2')
	// 		await runAllTests(true, true, 'proj1.0B').then(
	// 			() => { log.info('proj1.0B-3')},
	// 			(e) => { log.info('proj1.0B-4'); throw e })
	// 		log.info('proj1.0B-3')
	// 		done()
	// 	})
	// 	log.info('proj1.0B-4')
	// })

	// success!
	// test('proj1.0C setFilesExcludePattern - test run fail - catch', async () => {
	// 	log.info('proj1.0C-1')
	// 	return runAllTests(true, true, 'proj1.0C')
	// 		.then(() => { throw new Error('failed to throw exception') })
	// 		.catch(() => { return true })
	// })

	// success!
	// test('proj1.0D setFilesExcludePattern - test run fail - catch', async () => {
	// 	log.info('proj1.0D-1')
	// 	return runAllTests(true, true, 'proj1.0D')
	// 		.then(() => { throw new Error('failed to throw exception') },
	// 			(e) => { log.info('proj1.0D caught error! e=' + e); return })
	// })

	test('proj1.1A setFilesExcludePattern - test run fail - try await', async () => {
		log.info('proj1.1A-1')
		await updateConfig('ablunit.files.exclude', [ '.builder/**', '.pct/**', 'compileError.p' ])
		log.info('proj1.1A-2')
		await runAllTests(true, true, 'proj1.1A')
		log.info('proj1.1A-3')
	})

	test('proj1.1B setFilesExcludePattern - test run fail - try await', async () => {
		log.info('proj1.1B-1')
		const configProm = workspace.getConfiguration('ablunit').update('files.exclude', [ '.builder/**', '.pct/**', 'compileError.p' ]).then(() => { log.info('proj1.1A-2') })
		log.info('proj1.1B-3')
		await configProm
		log.info('proj1.1B-2')
		await runAllTests(true, true, 'proj1.1A')
		log.info('proj1.1B-3')
	})

	test('proj1.1C setFilesExcludePattern - test run fail - try await', async () => {
		log.info('proj1.1C-1')
		return workspace.getConfiguration('ablunit').update('files.exclude', [ '.builder/**', '.pct/**', 'compileError.p' ])
			.then(async () => {
				log.info('proj1.1C-2')
				return runAllTests(true, true, 'proj1.1B').then(() => {
					log.info('proj1.1C-3')
				})
			}, (e) => {
				assert.fail('caught error e=' + e)
			})
	})

	// test('proj1.1B setFilesExcludePattern - test run fail', async () => {
	// 	log.info('proj1.1B-1')
	// 	try {
	// 		log.info('proj1.1B-2')
	// 		await runAllTests(true, true, 'proj1.1B')
	// 		log.info('proj1.1B-3')

	// 		assert.fail('Error not caught')
	// 	} catch (e) {
	// 		log.info('proj1.1B-4')
	// 		assert.assert(e)
	// 	}
	// 	log.info('proj1.1B-5')
	// })

	// test('proj1.2 setFilesExcludePattern - test run pass', async () => {
	// 	try {
	// 		log.info(isoDate() + ' [proj1.3-1] workspaceFolder=' + workspace.workspaceFolders?.[0].uri.fsPath)
	// 		await workspace.getConfiguration('ablunit.files').update('exclude', [ '.builder/**', '.pct/**', 'compileError.p' ]).then(() => {
	// 			log.info(isoDate() + ' [proj1.3-2] ablunit.files.include' + workspace.getConfiguration('ablunit.files').get('include'))
	// 			log.info(isoDate() + ' [proj1.3-2] ablunit.files.exclude' + workspace.getConfiguration('ablunit.files').get('exclude'))
	// 			// return sleep2(100, 'sleep-1')
	// 		// }).then(async () => { return sleep2(100, 'sleep-2') })
	// 		})
	// 		// await sleep2(100, 'sleep-3')
	// 		log.info(isoDate() + ' [proj1.3-3]')
	// 		await assert.doesNotThrowAsync(async () => { await runAllTests(true, true, 'proj1.1') })
	// 		log.info(isoDate() + ' [proj1.3-4]')
	// 		// return assert.doesNotThrowAsync(() => runAllTests())
	// 	} catch (e) {
	// 		log.info(isoDate() + ' [proj1.3-4]')
	// 		assert.fail('Caught error unexpectedly! e=' + e)
	// 		log.info(isoDate() + ' [proj1.3-5]')
	// 	}
	// 	log.info(isoDate() + ' [proj1.3-6]')
	// })



	test('proj1.3A config - update', async () => {
		log.info('proj1.3A-1')
		await workspace.getConfiguration('ablunit').update('files.exclude', [ 'compileError.p' ])
		log.info('proj1.3A-2')
		const currentValue = workspace.getConfiguration('ablunit.files').get('exclude')
		log.info('proj1.3A-3')
		assert.deepEqual(currentValue, [ 'compileError.p' ])
		log.info('proj1.3A-4')
	})

	test('proj1.3B config - validate teardown reset', () => {
		// must run after a test that changes the files.exclude setting, such as proj1.3A
		log.info('proj1.3B-1')
		const currentValue = workspace.getConfiguration('ablunit.files').get('exclude')
		log.info('proj1.3B-2 currentValue=' + JSON.stringify(currentValue))
		const defaultValue = workspace.getConfiguration('ablunit.files').inspect('exclude')?.defaultValue
		log.info('proj1.3B-3 defaultValue=' + JSON.stringify(defaultValue))
		assert.deepEqual(currentValue, defaultValue)
	})


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
	// 	assert.assert(!settingsJson.includes('"ablunit.files.exclude": [".builder/**",".pct/**"]'), '"ablunit.files.exclude" should be undefined in .vscode/settings.json')
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

	test('proj1.20 output files exist', async () => {
		log.info('proj1.1 - output files exist - 1')
		log.info('proj1.1.10')
		const workspaceUri = getWorkspaceUri()
		log.info('proj1.1.11')
		assert.notFileExists('ablunit.json')
		log.info('proj1.1.15')
		assert.notFileExists('results.xml')
		log.info('proj1.1.16')

		log.info('proj1.1.20')
		await runAllTests().catch((e: unknown) => {
			log.info('Error caught and ignored: e=' + e)
		})

		assert.fileExists('ablunit.json')
		log.info('proj1.1.22')

		log.info('proj1.1.30 process.platform=' + process.platform + ', WLS_DISTRO_NAME=' + process.env['WSL_DISTRO_NAME'])
		if (process.platform === 'win32' || process.env['WSL_DISTRO_NAME'] !== undefined) {
			log.info('proj1.1.49 results.xml exists')
			assert.fileExists('results.xml')
		} else {
			log.info('proj1.1.50')
			assert.notFileExists('results.xml')
		}
		log.info('proj1.1.60')
		assert.notFileExists('results.json')
		log.info('proj1.1.70')
		// done()
		// log.info('proj1.1.80')
	})

	test('proj1.21 - output files exist 2 - exclude compileError.p', async () => {
		await workspace.getConfiguration('ablunit').update('files.exclude', [ '.builder/**', 'compileError.p' ]).then(async () => {
			return runAllTests()
		})
		// await updateConfig('ablunit.files.exclude', [ '.builder/**', 'compileError.p' ])
		// await runAllTests()

		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
		const testCount = await getTestCount(resultsJson)
		assert.equal(testCount, 12)
	})

	test('proj1.22 - output files exist 3 - exclude compileError.p as string', async () => {
		// this isn't officially supported and won't syntac check in the settings.json file(s), but it works
		await updateConfig('ablunit.files.exclude', 'compileError.p')
		await runAllTests()

		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
		const testCount = await getTestCount(resultsJson)
		assert.equal(testCount, 12)
	})

	test('proj1.23 - run test case in file', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(getWorkspaceUri(), 'procedureTest.p'))
		await commands.executeCommand('testing.runCurrentFile')

		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
		const testCount: number = await getTestCount(resultsJson)
		const pass = await getTestCount(resultsJson, 'pass')
		const fail = await getTestCount(resultsJson, 'fail')
		const error = await getTestCount(resultsJson, 'error')
		assert.equal(6, testCount, 'test count')
		assert.equal(2, pass, 'pass count')
		assert.equal(2, fail, 'fail count')
		assert.equal(2, error, 'error count')
	})

	test('proj1.24 - run test case at cursor', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(getWorkspaceUri(), 'procedureTest.p'))
		if(window.activeTextEditor) {
			window.activeTextEditor.selection = new Selection(21, 0, 21, 0)
		} else {
			assert.fail('vscode.window.activeTextEditor is undefined')
		}
		await commands.executeCommand('testing.runAtCursor')

		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
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
