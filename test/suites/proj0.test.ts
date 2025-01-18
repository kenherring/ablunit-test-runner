import { Uri, commands, window, workspace } from 'vscode'
import { assert, getRcodeCount, getResults, getTestControllerItemCount, getTestItem, getXrefCount, log, rebuildAblProject, refreshTests, runAllTests, runAllTestsWithCoverage, runTestAtLine, runTestsDuration, runTestsInFile, sleep2, suiteSetupCommon, toUri, updateConfig, updateTestProfile } from '../testCommon'
import { ABLResultsParser } from 'parse/ResultsParser'
import { TimeoutError } from 'Errors'
import * as vscode from 'vscode'
import * as FileUtils from '../../src/FileUtils'

function createTempFile () {
	const tempFile = toUri('UNIT_TEST.tmp')
	FileUtils.writeFile(tempFile, '')
	return tempFile
}

suite('proj0  - Extension Test Suite', () => {

	const disposables: vscode.Disposable[] = []

	suiteSetup('proj0 - before', async () => {
		FileUtils.copyFile(toUri('.vscode/settings.json'), toUri('.vscode/settings.json.bk'), { force: true })

		FileUtils.deleteFile([
			toUri('.vscode/ablunit-test-profile.json'),
			toUri('src/dirA/proj10.p'),
			toUri('UNIT_TEST.tmp'),
		], { force: true })

		await suiteSetupCommon()
		await commands.executeCommand('testing.clearTestResults')
		return
	})

	teardown('proj0 - afterEach', () => {
		log.info('proj0 teardown')
		FileUtils.deleteFile([
			toUri('.vscode/ablunit-test-profile.json'),
			toUri('src/dirA/proj10.p'),
			toUri('UNIT_TEST.tmp'),
		], { force: true })
		log.info('200')
		while (disposables.length > 0) {
			log.info('201')
			const d = disposables.pop()
			log.info('202')
			if (d) {
				log.info('203')
				d.dispose()
				log.info('204')
			} else {
				log.info('205')
				log.warn('disposables.length != 0')
				log.info('206')
			}
			log.info('207')
		}
		log.info('208')
		// FileUtils.copyFile(toUri('.vscode/settings.json.bk'), toUri('.vscode/settings.json'))
		log.info('209')
		return
	})

	suiteTeardown('proj0 - after', () => {
		log.info('300')
		FileUtils.renameFile(toUri('.vscode/settings.json.bk'), toUri('.vscode/settings.json'))
		log.info('301')
	})

	test('proj0.01 - ${workspaceFolder}/ablunit.json file exists', () => {
		log.info('start ----- proj0.01')
		const prom = runAllTests()
			.then(() => getResults())
			.then((recentResults) => {
				assert.equal(recentResults[0].cfg.ablunitConfig.config_uri, toUri('ablunit.json'), 'ablunit.json path mismatch')
				assert.fileExists('ablunit.json', 'results.xml')
				assert.notFileExists('results.json')
				assert.notDirExists('listings')
				return true
			})
			.catch((e: unknown) => { throw e })
		return prom
	})

	test('proj0.02 - run test, open file, validate coverage displays', async () => {
		await rebuildAblProject()
		let rcodeCount = getRcodeCount()
		while (rcodeCount < 10) {
			await sleep2(250)
			rcodeCount = getRcodeCount()
		}
		if (getRcodeCount() === 0) {
			assert.fail('no rcode files found')
		}

		if (getXrefCount() === 0) {
			assert.fail('no xref files found')
		}
		await runAllTestsWithCoverage().then(() => {
			log.info('runAllTestsWithCoverage.then')
			return true
		})
		assert.linesExecuted('src/dirA/dir1/testInDir.p', [5, 6])
	})

	// is it possible to validate the line coverage displayed and not just the reported coverage?  does it matter?
	test('proj0.03 - open file, run test, validate coverage displays', async () => {
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri)
		await runAllTestsWithCoverage()

		const lines = (await getResults())[0].statementCoverage.get(testFileUri.fsPath) ?? []
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.linesExecuted(testFileUri, [5, 6])
	})

	test('proj0.04 - coverage=false, open file, run test, validate no coverage displays', async () => {
		await updateTestProfile('profiler.coverage', false)
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri)
		await runAllTests()

		const lines = (await getResults())[0].statementCoverage.get(testFileUri.fsPath) ?? []
		if (lines && lines.length > 0) {
			assert.fail('coverage should be empty for ' + workspace.asRelativePath(testFileUri) + ' (lines.length=' + lines.length + ')')
		}
		const executedLines = lines.filter((d) => d)
		log.debug('executedLines.length=' + executedLines.length)
		assert.equal(0, executedLines.length, 'executed lines found for ' + workspace.asRelativePath(testFileUri) + '. should be empty')
	})

	test('proj0.05 - parse test class with expected error annotation', async () => {
		const testClassItem = await commands.executeCommand('vscode.open', toUri('src/threeTestMethods.cls'))
			.then(() => { return sleep2(250) })
			.then(() => { return getTestItem(toUri('src/threeTestMethods.cls')) })

		if (!testClassItem) {
			throw new Error('cannot find TestItem for src/threeTestMethods.cls')
		}

		assert.equal(testClassItem.children.size, 3, 'testClassItem.children.size should be 3')
	})

	test('proj0.06 - parse test program with expected error annotation', async () => {
		await commands.executeCommand('vscode.open', toUri('src/threeTestProcedures.p'))
		await sleep2(250)
		const testClassItem = await getTestItem(toUri('src/threeTestProcedures.p'))

		if (!testClassItem) {
			throw new Error('cannot find TestItem for src/threeTestProcedures.p')
		}
		assert.equal(testClassItem.children.size, 3, 'testClassItem.children.size should be 3')
	})

	test('proj0.07 - parse test class with skip annotation', async () => {
		await commands.executeCommand('vscode.open', toUri('src/ignoreMethod.cls'))
		await sleep2(100)
		const testClassItem = await getTestItem(toUri('src/ignoreMethod.cls'))

		if (!testClassItem) {
			log.error('cannot find TestItem for src/ignoreMethod.cls')
			assert.fail('cannot find TestItem for src/ignoreMethod.cls')
			throw new Error('cannot find TestItem for src/ignoreMethod.cls')
		}
		assert.equal(testClassItem.children.size, 5, 'testClassItem.children.size should be 5')
	})

	test('proj0.08 - parse test procedure with skip annotation', async () => {
		log.info('start proj0.08')
		await commands.executeCommand('vscode.open', toUri('src/ignoreProcedure.p'))
		await sleep2(250)
		log.info('600')
		const testClassItem = await getTestItem(toUri('src/ignoreProcedure.p'))
		log.info('601')
		log.info('601')

		if (!testClassItem) {
			log.info('602')
			log.error('cannot find TestItem for src/ignoreProcedure.p')
			log.info('603')
			assert.fail('cannot find TestItem for src/ignoreProcedure.p')
			log.info('604')
			// throw new Error('cannot find TestItem for src/ignoreProcedure.p')
		}
		log.info('605')
		assert.equal(testClassItem.children.size, 5, 'testClassItem.children.size should be 5')
	})

	test('proj0.09 - ABLResultsParser', async () => {
		const rp = new ABLResultsParser()
		await rp.parseResults(toUri('results_test1.xml'))
			.then(() => {
				log.info('parsed results_test1.xml successfully')
				return true
			}, (e: unknown) => {
				if (e instanceof Error) {
					log.info('e.message=' + e.message)
					log.info('e.stack=' + e.stack)
				}
				assert.fail('error parsing results_test1.xml: ' + e)
			})
		return
	})

	test('proj0.10A - Create File', async () => {
		// init test
		await refreshTests()
		const startCount = await getTestControllerItemCount()
		const tempFile = createTempFile()
		// This event handler makes use wait for a second edit so we know that the first edit has been processed
		// Inspiration: https://github.com/microsoft/vscode/blob/main/extensions/vscode-api-tests/src/singlefolder-tests/workspace.event.test.ts#L80
		disposables.push(vscode.workspace.onWillCreateFiles(e => {
			const ws = new vscode.WorkspaceEdit()
			ws.insert(tempFile, new vscode.Position(0, 0), 'onWillCreate ' + e.files.length + ' ' + e.files[0].fsPath)
			e.waitUntil(Promise.resolve(ws))
		}))

		// create new test program
		const edit = new vscode.WorkspaceEdit()
		edit.createFile(toUri('src/dirA/proj10.p'), { contents: Buffer.from('@Test. procedure test1: end procedure.') })
		const success = await workspace.applyEdit(edit)
		assert.ok(success)

		// validate test item increase
		const endCount = await getTestControllerItemCount()
		assert.equal(endCount - startCount, 1, 'test file count delta')
		return
	})

	test('proj0.10B - Update File', async () => {
		// init test
		// const tempFile = await createTempFile()
		// disposables.push(vscode.workspace.onWillCreateFiles(e => {
		// 	const ws = new vscode.WorkspaceEdit()
		// 	ws.insert(tempFile, new vscode.Position(0, 0), 'onWillCreate ' + e.files.length + ' ' + e.files[0].fsPath)
		// 	e.waitUntil(Promise.resolve(ws))
		// }))
		await workspace.fs.writeFile(toUri('src/dirA/proj10.p'), Buffer.from('@Test. procedure test1: end procedure.'))
		await commands.executeCommand('vscode.open', toUri('src/dirA/proj10.p'))
			.then((r) => {
				log.info('opened file (r=' + r + ')')
				return sleep2(250)
			}, (e: unknown) => { throw e })

		const startCount = await getTestItem(toUri('src/dirA/proj10.p'))
			.then((r) => {
				for (const [ ,c] of r.children) {
					log.info('c.label=' + c.label + '; c.id='  + c.id)
				}
				return r.children.size
			}, (e: unknown) => { throw e })


		// update test program
		const edit = new vscode.WorkspaceEdit()
		edit.createFile(toUri('src/dirA/proj10.p'), { overwrite: true, contents: Buffer.from('@Test. procedure test1: end procedure.\n\n@Test. procedure test2: end procedure.\n\n@Test. procedure test3: end procedure.') })
		const success = await workspace.applyEdit(edit)
		assert.ok(success)

		// validate test case items added
		await sleep2(250) // TODO - remove me
		const endCount = await getTestItem(toUri('src/dirA/proj10.p'))
			.then((r) => {
				for (const [ ,c] of r.children) {
					log.info('c.label=' + c.label + '; c.id='  + c.id)
				}
				return r.children.size
			}, (e: unknown) => { throw e })
		assert.equal(endCount - startCount, 2, 'test cases added != 2 (endCount=' + endCount + '; startCount=' + startCount + ')')
	})

	test('proj0.10C - Delete File', async () => {
		// init tests
		FileUtils.copyFile(toUri('src/dirA/proj10.p.orig'), toUri('src/dirA/proj10.p'))
		const startCount = await refreshTests()
			.then(() => { return getTestControllerItemCount('ABLTestFile') })
		const tempFile = createTempFile()
		disposables.push(vscode.workspace.onWillDeleteFiles(e => {
			const ws = new vscode.WorkspaceEdit()
			ws.insert(tempFile, new vscode.Position(0, 0), 'onWillDelete ' + e.files.length + ' ' + e.files[0].fsPath)
			e.waitUntil(Promise.resolve(ws))
		}))

		// delete test program
		log.info('deleting src/dirA/proj11.p')
		await workspace.fs.delete(toUri('src/dirA/proj10.p'))

		// validate test item reduction
		await refreshTests()
		assert.equal(await getTestControllerItemCount('ABLTestFile') - startCount, -1, 'after delte file count: startCount !+ test count')
		return
	})

	test('proj0.11 - timeout 5s', () => {
		const prom = updateConfig('ablunit.files.exclude', '**/.{builder,pct}/**')
			.then(() => { return updateTestProfile('timeout', 5000) })
			.then(() => { return sleep2(250) })
			.then(() => { return runTestsInFile('src/timeout.p', 0) })
			.then(() => {
				return assert.fail('expected TimeoutError to be thrown')
			}, (e: unknown) => {
				log.info('e=' + e)
				return assert.tests.timeout(e)
			})
		return prom
	})

	test('proj0.12 - timeout 1500ms fail', () => {
		const prom = updateConfig('ablunit.files.exclude', '**/.{builder,pct}/**')
			.then(() => { return updateTestProfile('timeout', 1500) })
			.then(() => { return runTestAtLine('src/timeout.p', 37, 0) })
			.then(() => { return commands.executeCommand('_ablunit.getTestRunError') })
			.then(() => {
				return assert.fail('expected TimeoutError to be thrown')
			}, (e: unknown) => {
				log.info('e=' + e)
				assert.tests.timeout(e)
				const t: TimeoutError = e as TimeoutError
				assert.durationMoreThan(t.duration, 1500)
				assert.durationLessThan(t.duration, 2000)
				return
			})
		return prom
	})

	test('proj0.13 - timeout 2500ms pass', () => {
		const prom = updateTestProfile('timeout', 2500)
			.then(() => { return updateConfig('ablunit.files.exclude', '**/.{builder,pct}/**') })
			.then(() => { return sleep2(100) })
			.then(() => { return runTestAtLine('src/timeout.p', 37, 0) })
			.then(() => { return commands.executeCommand('_ablunit.getTestRunError') })
			.then((e) => {
				if (e) {
					assert.equal(e, undefined, 'expected no error to be thrown, but got e=' + JSON.stringify(e, null, 2))
					assert.fail('expected no error to be thrown but got e=' + JSON.stringify(e, null, 2))
				}
				assert.durationMoreThan(runTestsDuration, 2000)
				assert.durationLessThan(runTestsDuration, 3250)
				return
			})
		return prom
	})

	test('proj0.14 - timeout invalid -5s', () => {
		const prom = updateTestProfile('timeout', -5000)
			.then(() => { return runTestsInFile('src/simpleTest.p', 0) })
			.then(() => { return commands.executeCommand('_ablunit.getTestRunError') })
			.then((e) => {
				return assert.fail('expected RangeError to be thrown but got e=' + JSON.stringify(e, null, 2))
			}, (e: unknown) => {
				if (e instanceof Error) {
					log.info('e=' + JSON.stringify(e))
					assert.equal(e.name, 'RangeError', 'expecting RangeError due to negative timeout value. e=' + JSON.stringify(e, null, 2))
				} else {
					assert.fail('expected RangeError to be thrown but got e=' + JSON.stringify(e, null, 2))
				}
				return
			})
		return prom
	})

	test('proj0.17 - coverage in class property getters/setters', async () => {
		FileUtils.deleteFile([toUri('results.xml'), toUri('results.json')], { force: true })
		FileUtils.copyFile(toUri('.vscode/ablunit-test-profile.proj0.17.json'), toUri('.vscode/ablunit-test-profile.json'))
		await runTestAtLine('src/test_17.cls', 33, 1, true)
			.then(() => {
				assert.tests.count(1)
				assert.tests.passed(1)
				assert.tests.failed(0)
				assert.tests.errored(0)
				assert.tests.skipped(0)
				assert.linesExecuted('src/test_17.cls', [6, 7, 8])
				assert.linesExecuted('src/test_17.cls', [40, 41, 42, 43])
			})
	})

	test('proj0.18 - not 100% coverage', async () => {
		await runTestsInFile('src/threeTestProcedures.p', 1, true)
		const res = await getResults()
		assert.equal(res.length, 1, 'ABLResults[].length')
		assert.equal(res[0].profileJson.length, 5, 'ABLResults[0].profileJson[].length')

		const fc = res[0].fileCoverage.get(toUri('src/threeTestProcedures.p').fsPath)
		const sc = res[0].statementCoverage.get(toUri('src/threeTestProcedures.p').fsPath) ?? []
		const dc = res[0].declarationCoverage.get(toUri('src/threeTestProcedures.p').fsPath) ?? []
		assert.ok(fc, 'fileCoverage')
		assert.greater(sc.length, 10, 'statementCoverage[].length')
		assert.equal(dc.length, 5, 'declarationCoverage[].length')

		assert.ok(fc?.branchCoverage == undefined, 'branchCoverage')
		assert.equal(fc?.declarationCoverage?.total, 5, 'fc.declarationCoverage.total')
		assert.equal(fc?.statementCoverage?.total, 19, 'fc.statementCoverage.total')
		assert.less(fc?.declarationCoverage?.covered ?? 0, fc?.declarationCoverage?.total ?? 0,
			'declarationCoverage not 100% (' + (fc?.declarationCoverage?.covered ?? 0) + ' >= ' + (fc?.declarationCoverage?.total ?? 0) + ')')
		assert.less(fc?.statementCoverage?.covered ?? 0, fc?.statementCoverage?.total ?? 0,
			'statementCoverage not 100% (' + (fc?.statementCoverage?.covered ?? 0) + ' >= ' + (fc?.statementCoverage?.total ?? 0) + ')')
	})

	test('proj0.19 - program runs external source', async () => {
		await runTestsInFile('src/test19.p', 1, true)
		const res = await getResults()
		assert.equal(res.length, 1, 'ABLResults[].length')
		assert.equal(res[0].fileCoverage.size, 1, 'ABLResults[0].fileCoverage.size')
		assert.equal(res[0].declarationCoverage.size, 1, 'ABLResults[0].declarationCoverage.size')

		let cnt = 0
		res[0].declarationCoverage.forEach((dc, path) => {
			log.info('dc uri=' + path + ', dc=' + JSON.stringify(dc))
			assert.equal(dc.length, 3, 'dc.length')
			cnt++
		})
		assert.equal(cnt, 1, 'declarationCoverage count')
	})

})
