import { Uri, commands, window, workspace } from 'vscode'
import * as vscode from 'vscode'
import { assert, deleteFile, getResults, getTestControllerItemCount, getTestItem, log, refreshTests, runAllTests, runAllTestsWithCoverage, runTestAtLine, runTestsDuration, runTestsInFile, sleep2, suiteSetupCommon, toUri, updateConfig, updateTestProfile } from '../testCommon'
import { ABLResultsParser } from 'parse/ResultsParser'
import * as fs from 'fs'
import { TimeoutError } from 'ABLUnitRun'

function createTempFile () {
	const tempFile = toUri('UNIT_TEST.tmp')
	return workspace.fs.writeFile(tempFile, Buffer.from(''))
		.then(() => { return tempFile })
}

suite('proj0  - Extension Test Suite', () => {

	const disposables: vscode.Disposable[] = []

	suiteSetup('proj0 - before', () => {
		deleteFile('.vscode/ablunit-test-profile.json')
		deleteFile('src/dirA/proj10.p')
		deleteFile('UNIT_TEST.tmp')
		return suiteSetupCommon()
			.then(() => { return commands.executeCommand('testing.clearTestResults') })
			.then(() => { return workspace.fs.copy(toUri('.vscode/settings.json'), toUri('.vscode/settings.json.bk'), { overwrite: true }) })
	})

	teardown('proj0 - afterEach', () => {
		deleteFile('.vscode/ablunit-test-profile.json')
		deleteFile('src/dirA/proj10.p')
		deleteFile('UNIT_TEST.tmp')
		while (disposables.length > 0) {
			const d = disposables.pop()
			if (d) {
				d.dispose()
			} else {
				log.warn('disposables.length != 0')
			}
		}
		return workspace.fs.copy(toUri('.vscode/settings.json.bk'), toUri('.vscode/settings.json'), { overwrite: true })
			.then(() => { log.info('proj0 teardown --- end'); return })
	})

	test('proj0.01 - ${workspaceFolder}/ablunit.json file exists', () => {
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
		await runAllTestsWithCoverage()
			.then(() => { assert.linesExecuted('src/dirA/dir1/testInDir.p', [5, 6]) })
	})

	// is it possible to validate the line coverage displayed and not just the reported coverage?  does it matter?
	test.skip('proj0.3 - open file, run test, validate coverage displays', async () => {
		const testFileUri = toUri('src/dirA/dir1/testInDir.p')
		await window.showTextDocument(testFileUri)
		await runAllTestsWithCoverage()

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath) ?? []
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.linesExecuted(testFileUri, [5, 6])
	})

	test('proj0.04 - coverage=false, open file, run test, validate no coverage displays', async () => {
		await updateTestProfile('profiler.coverage', false)
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri)
		await runAllTests()

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath) ?? []
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
		const testClassItem = await commands.executeCommand('vscode.open', toUri('src/threeTestProcedures.p'))
			.then(() => { return sleep2(250) })
			.then(() => { return getTestItem(toUri('src/threeTestProcedures.p')) })

		if (!testClassItem) {
			throw new Error('cannot find TestItem for src/threeTestProcedures.p')
		}
		assert.equal(testClassItem.children.size, 3, 'testClassItem.children.size should be 3')
	})

	test('proj0.07 - parse test class with skip annotation', async () => {
		const testClassItem = await commands.executeCommand('vscode.open', toUri('src/ignoreMethod.cls'))
			.then(() => { return sleep2(250) })
			.then(() => { return getTestItem(toUri('src/ignoreMethod.cls')) })

		if (!testClassItem) {
			throw new Error('cannot find TestItem for src/ignoreMethod.cls')
		}
		assert.equal(testClassItem.children.size, 5, 'testClassItem.children.size should be 5')
	})

	test('proj0.08 - parse test procedure with skip annotation', async () => {
		const testClassItem = await commands.executeCommand('vscode.open', toUri('src/ignoreProcedure.p'))
			.then(() => { return sleep2(250) })
			.then(() => { return getTestItem(toUri('src/ignoreProcedure.p')) })

		if (!testClassItem) {
			throw new Error('cannot find TestItem for src/ignoreProcedure.p')
		}
		assert.equal(testClassItem.children.size, 5, 'testClassItem.children.size should be 5')
	})

	test('proj0.9 - ABLResultsParser', () => {
		const rp = new ABLResultsParser()
		return rp.parseResults(toUri('results_test1.xml'))
			.then(() => {
				log.info('parsed results_test1.xml successfully')
				return
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
		const tempFile = await createTempFile()
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
			}, (e:unknown) => { throw e })


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
		fs.copyFileSync(toUri('src/dirA/proj10.p.orig').fsPath, toUri('src/dirA/proj10.p').fsPath)
		const startCount = await refreshTests()
			.then(() => { return getTestControllerItemCount('ABLTestFile') })
		const tempFile = await createTempFile()
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
		return updateConfig('ablunit.files.exclude', '**/.{builder,pct}/**')
			.then((r) => { return updateTestProfile('timeout', 5000) })
			.then((r) => { return sleep2(250) })
			.then((r) => { return runTestsInFile('src/timeout.p', 0) })
			.then(() => { return commands.executeCommand('_ablunit.getTestRunError') })
			.then((e) => {
				assert.tests.timeout(e)
				return
			})
	})

	test('proj0.12 - timeout 1500ms fail', () => {
		return updateConfig('ablunit.files.exclude', '**/.{builder,pct}/**')
			.then(() => { return updateTestProfile('timeout', 1500) })
			.then(() => { return runTestAtLine('src/timeout.p', 37, 0) })
			.then(() => { return commands.executeCommand('_ablunit.getTestRunError') })
			.then((e) => {
				assert.tests.timeout(e)
				const t: TimeoutError = e as TimeoutError
				assert.durationMoreThan(t.duration, 1500)
				assert.durationLessThan(t.duration, 2000)
				return
			})
	})

	test('proj0.13 - timeout 2500ms pass', () => {
		return updateTestProfile('timeout', 2500)
			.then(() => { return updateConfig('ablunit.files.exclude', '**/.{builder,pct}/**') })
			.then(() => { return sleep2(500)})
			.then(() => { return runTestAtLine('src/timeout.p', 37, 0) })
			.then(() => { return commands.executeCommand('_ablunit.getTestRunError') })
			.then((e) => {
				if (e) {
					assert.equal(e, undefined, 'expected no error to be thrown, but got e=' + JSON.stringify(e, null, 2))
					assert.fail('expected no error to be thrown but got e=' + JSON.stringify(e, null, 2))
				}
				assert.durationMoreThan(runTestsDuration, 2000)
				assert.durationLessThan(runTestsDuration, 3000)
				return
			})
	})

	test('proj0.14 - timeout invalid -5s', () => {
		return updateTestProfile('timeout', -5000)
			.then(() => { return runTestsInFile('src/simpleTest.p', 0) })
			.then(() => { return commands.executeCommand('_ablunit.getTestRunError') })
			.then((e) => {
				if (e instanceof Error) {
					log.info('e=' + JSON.stringify(e))
					assert.equal(e.name, 'RangeError', 'expecting RangeError due to negative timeout value. e=' + JSON.stringify(e, null, 2))
				} else {
					assert.fail('expected RangeError to be thrown but got e=' + JSON.stringify(e, null, 2))
				}
				return
			})
	})

})
