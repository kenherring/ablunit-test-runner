import { DeclarationCoverage, FileCoverageDetail, Range, TestRunProfileKind, Uri, commands, window, workspace } from 'vscode'
import { assert, getRcodeCount, getResults, getTestControllerItemCount, getTestItem, getXrefCount, log, rebuildAblProject, refreshTests, runAllTests, runAllTestsWithCoverage, runTestAtLine, runTestsDuration, runTestsInFile, sleep2, suiteSetupCommon, FileUtils, toUri, updateConfig, updateTestProfile, deleteRcode, setRuntimes } from '../testCommon'
import { ABLResultsParser } from 'parse/ResultsParser'
import { TimeoutError } from 'Errors'
import { restartLangServer } from '../openedgeAblCommands'
import * as glob from 'glob'
import * as vscode from 'vscode'

function createTempFile () {
	const tempFile = toUri('UNIT_TEST.tmp')
	FileUtils.writeFile(tempFile, '')
	return tempFile
}

suite('proj0  - Extension Test Suite', () => {

	const disposables: vscode.Disposable[] = []

	suiteSetup('proj0 - before', async () => {
		FileUtils.copyFile(toUri('.vscode/settings.json'), toUri('.vscode/settings.json.bk'), { force: true })
		FileUtils.copyFile(toUri('openedge-project.json'), toUri('openedge-project.json.bk'), { force: true })

		FileUtils.deleteDir(toUri('d1'))
		FileUtils.deleteDir(toUri('d2'))
		FileUtils.deleteFile([
			toUri('.vscode/ablunit-test-profile.json'),
			toUri('src/dirA/proj10.p'),
			toUri('UNIT_TEST.tmp'),
		], { force: true })

		const rcodeFiles = glob.globSync('**/*.r', { absolute: true, nodir: true, cwd: workspace.workspaceFolders![0].uri.fsPath })

		const rcodeUris: Uri[] = []
		for (const rcodeFile of rcodeFiles) {
			rcodeUris.push(Uri.file(rcodeFile))
		}
		FileUtils.deleteFile(rcodeUris, { force: true })
		let waitCounter = 0
		while (getRcodeCount() > 0) {
			waitCounter++
			await sleep2(25)
		}
		log.info('waited ' + waitCounter + ' times for rcode files to be deleted')

		await suiteSetupCommon()
		await commands.executeCommand('testing.clearTestResults')
		return
	})

	setup('proj0 - setup', async () => {
		const oever = process.env['ABLUNIT_TEST_RUNNER_OE_VERSION'] ?? process.env['OE_VERSION']
		if (oever === '12.2') {
			await setRuntimes([{name: '12.2', path: 'C:\\Progress\\OpenEdge', default: true}])
		}
	})

	teardown('proj0 - afterEach', () => {
		log.info('proj0 teardown')
		FileUtils.deleteFile([
			toUri('.vscode/ablunit-test-profile.json'),
			toUri('results.json'),
			toUri('results.xml'),
			toUri('src/dirA/proj10.p'),
			toUri('UNIT_TEST.tmp'),
		], { force: true })
		while (disposables.length > 0) {
			const d = disposables.pop()
			if (d) {
				d.dispose()
			} else {
				log.warn('disposables.length != 0')
			}
		}
	})

	suiteTeardown('proj0 - after', () => {
		FileUtils.renameFile(toUri('.vscode/settings.json.bk'), toUri('.vscode/settings.json'))
		FileUtils.renameFile(toUri('openedge-project.json.bk'), toUri('openedge-project.json'))
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
		let rcodeCount = await rebuildAblProject()
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
		assert.linesExecuted('src/dirA/dir1/testInDir.p', [6, 7])
	})

	// is it possible to validate the line coverage displayed and not just the reported coverage?  does it matter?
	test('proj0.03 - open file, run test, validate coverage displays', async () => {
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri)
		await runAllTestsWithCoverage()

		const lines = (await getResults())[0].statementCoverage.get(testFileUri.fsPath) ?? []
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.linesExecuted(testFileUri, [6, 7])
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
		await commands.executeCommand('vscode.open', toUri('src/ignoreProcedure.p'))
		await sleep2(250)
		const testClassItem = await getTestItem(toUri('src/ignoreProcedure.p'))

		if (!testClassItem) {
			log.error('cannot find TestItem for src/ignoreProcedure.p')
			assert.fail('cannot find TestItem for src/ignoreProcedure.p')
			// throw new Error('cannot find TestItem for src/ignoreProcedure.p')
		}
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
					log.error('e.message=' + e.message)
					log.error('e.stack=' + e.stack)
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
			.then((r) => r.children.size)

		// update test program
		const edit = new vscode.WorkspaceEdit()
		edit.createFile(toUri('src/dirA/proj10.p'), { overwrite: true, contents: Buffer.from('@Test. procedure test1: end procedure.\n\n@Test. procedure test2: end procedure.\n\n@Test. procedure test3: end procedure.') })
		const success = await workspace.applyEdit(edit)
		assert.ok(success)

		// validate test case items added
		await sleep2(250) // TODO - remove me
		const endCount = await getTestItem(toUri('src/dirA/proj10.p'))
			.then((r) => r.children.size)
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

	test('proj0.13 - timeout 2500ms pass', async () => {
		await updateTestProfile('timeout', 2500)
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
		return
	})

	test('proj0.14 - timeout invalid -5s', async () => {
		const prom = updateTestProfile('timeout', -5000)
			.then(() => { return runTestsInFile('src/simpleTest.p', 0) })
			.then(() => { return commands.executeCommand('_ablunit.getTestRunError') })
			.then((e) => {
				return assert.fail('expected RangeError to be thrown but got e=' + JSON.stringify(e, null, 2))
			}, (e: unknown) => {
				if (e instanceof Error) {
					log.info('e=' + JSON.stringify(e))
					assert.equal(e.name, 'RangeError', 'expecting RangeError due to negative timeout value. e=' + JSON.stringify(e, null, 2))
					return true
				}
				assert.fail('expected RangeError to be thrown but got e=' + JSON.stringify(e, null, 2))
				return false
			})
		return await prom
	})

	test('proj0.17 - coverage in class property getters/setters', () => {
		log.info('proj0.17')
		FileUtils.deleteFile(
			[
				toUri('results.xml'),
				// toUri('.vscode/ablunit-test-profile.json'),
				toUri('results.json')
			],
			{ force: true }
		)
		if (FileUtils.doesFileExist(toUri('.vscode/ablunit-test-profile.json'))) {
			assert.fail('.vscode/ablunit-test-profile.json should not exist')
		}
		FileUtils.copyFile(toUri('.vscode/ablunit-test-profile.proj0.17.json'), toUri('.vscode/ablunit-test-profile.json'))
		const prom = runTestAtLine('src/test_17.cls', 33, 1, TestRunProfileKind.Coverage)
			.then(() => {
				assert.tests.count(1)
				assert.tests.passed(1)
				assert.tests.failed(0)
				assert.tests.errored(0)
				assert.tests.skipped(0)
				assert.linesExecuted('src/test_17.cls', [7, 8, 9])
				assert.linesExecuted('src/test_17.cls', [41, 42, 43, 44])
				return
			})
		return prom
	})

	test('proj0.18 - not 100% coverage', async () => {
		await runTestsInFile('src/threeTestProcedures.p', 1, TestRunProfileKind.Coverage)
		const res = await getResults()
		assert.equal(res.length, 1, 'ABLResults[].length')
		assert.equal(res[0].profileJson.length, 6, 'ABLResults[0].profileJson[].length')

		const fc = res[0].fileCoverage.get(toUri('src/threeTestProcedures.p').fsPath)
		const sc = res[0].statementCoverage.get(toUri('src/threeTestProcedures.p').fsPath) ?? []
		const dc = res[0].declarationCoverage.get(toUri('src/threeTestProcedures.p').fsPath) ?? []
		assert.ok(fc, 'fileCoverage')
		assert.greater(sc.length, 10, 'statementCoverage[].length')
		assert.equal(dc.length, 5, 'declarationCoverage[].length')

		assert.ok(fc?.branchCoverage == undefined, 'branchCoverage')
		assert.equal(fc?.declarationCoverage?.total, 5, 'fc.declarationCoverage.total')
		assert.equal(fc?.statementCoverage?.total, 22, 'fc.statementCoverage.total (expect=22, actual=' + fc?.statementCoverage?.total + ')')
		assert.less(fc?.declarationCoverage?.covered ?? 0, fc?.declarationCoverage?.total ?? 0,
			'declarationCoverage not 100% (' + (fc?.declarationCoverage?.covered ?? 0) + ' >= ' + (fc?.declarationCoverage?.total ?? 0) + ')')
		assert.less(fc?.statementCoverage?.covered ?? 0, fc?.statementCoverage?.total ?? 0,
			'statementCoverage not 100% (' + (fc?.statementCoverage?.covered ?? 0) + ' >= ' + (fc?.statementCoverage?.total ?? 0) + ')')
	})

	test('proj0.19 - program runs external source', async () => {
		await runTestsInFile('src/test19.p', 1, TestRunProfileKind.Coverage)
		const res = await getResults()
		assert.equal(res.length, 1, 'ABLResults[].length')
		assert.equal(res[0].fileCoverage.size, 1, 'ABLResults[0].fileCoverage.size')
		assert.equal(res[0].declarationCoverage.size, 1, 'ABLResults[0].declarationCoverage.size')

		let cnt = 0
		res[0].declarationCoverage.forEach((dc, path) => {
			assert.equal(dc.length, 4, 'dc.length (path=' + path + ')')
			cnt++
		})
		assert.equal(cnt, 1, 'declarationCoverage count')

		await commands.executeCommand('testing.openCoverage')
		await sleep2(100)

		// const coverage: FileCoverage = await commands.executeCommand('testing.coverage.uri', toUri('src/test19.p'))
		// log.info('coverage=' + JSON.stringify(coverage, null, 2))

		for (const child of res[0].tests[0].children) {
			const [testId, ] = child
			const r = await commands.executeCommand('_ablunit.loadDetailedCoverageForTest', toUri('src/test19.p'), testId).then((r) => {
				log.info('success')
				return r
			}, (e: unknown) => {
				log.error('e=' + e)
				throw e
			})
			log.debug('r=' + JSON.stringify(r, null, 2))
		}
	})

	test('proj0.20 - build directory', async () => {
		FileUtils.copyFile('openedge-project.test20.json', 'openedge-project.json')
		await deleteRcode()

		const rcodeCount = await restartLangServer()
			.then(() => rebuildAblProject(16))

		assert.greaterOrEqual(rcodeCount, 16, 'rcodeCount > 0')
		assert.fileExists('d1/test_20.r')
		assert.fileExists('d2/test_20.p.xref')

		await runTestsInFile('src/test_20.p', 1, TestRunProfileKind.Coverage)
			.then(() => {
				assert.tests.count(1)
				assert.coverageProcessingMethod(toUri('src/test_20.p'), 'rcode')
			})
	})

	test('proj0.21 - overloaded method coverage', async () => {
		await runTestsInFile('src/overloadedMethods.cls', 1, TestRunProfileKind.Coverage)
		assert.tests.count(2)
		assert.linesExecuted('src/overloadedMethods.cls', [17, 18, 19, 22, 23])
		assert.linesNotExecuted('src/overloadedMethods.cls', [21])
		const cov: FileCoverageDetail[] = await commands.executeCommand('_ablunit.loadDetailedCoverage', toUri('src/overloadedMethods.cls'))
		// validate we've captured the method header - executed declaration, starts are char 0
		const methodName = cov.find(c => c instanceof DeclarationCoverage && c.name === 'methodName') as DeclarationCoverage
		if (methodName.location instanceof Range) {
			assert.equal(methodName.location.start.line, 29, 'methodName.location.start.line')
		} else {
			assert.fail('methodName.location not instanceof Range')
		}

		// validate we've captured the method header - executed declaration, starts indented
		const methodName2 = cov.find(c => c instanceof DeclarationCoverage && c.name === 'methodName2') as DeclarationCoverage
		if (methodName2.location instanceof Range) {
			assert.equal(methodName2.location.start.line, 35, 'methodName2.location.start.line')
		} else {
			assert.fail('methodName2.location not instanceof Range')
		}

		// ---------- TODO - not currently captured ----------
		// // validate we've captured the method header - not executed
		// const notOverloaded = cov.find(c => c instanceof DeclarationCoverage && c.name === 'notOverloaded') as DeclarationCoverage
		// if (notOverloaded.location instanceof Range) {
		// 	assert.equal(notOverloaded.location.start.line, 47, 'notOverloaded.location.start.line')
		// } else {
		// 	assert.fail('notOverloaded.location not instanceof Range')
		// }

		// // validate we've captured the method header - overloaded methods
		// const overloadMethod_1 = cov.find(c => c instanceof DeclarationCoverage && c.name === 'overloadMethod' ) as DeclarationCoverage
		// if (overloadMethod_1.location instanceof Range) {
		// 	assert.equal(overloadMethod_1.location.start.line, 6, 'overloadMethod.location.start.line')
		// } else {
		// 	assert.fail('overloadMethod.location not instanceof Range')
		// }
		// const overloadMethod_2 = cov.find(c => c instanceof DeclarationCoverage && c.name === 'overloadMethod' ) as DeclarationCoverage
		// if (overloadMethod_2.location instanceof Range) {
		// 	assert.equal(overloadMethod_2.location.start.line, 10, 'overloadMethod.location.start.line')
		// } else {
		// 	assert.fail('overloadMethod.location not instanceof Range')
		// }
		// const overloadMethod_3 = cov.find(c => c instanceof DeclarationCoverage && c.name === 'overloadMethod' ) as DeclarationCoverage
		// if (overloadMethod_3.location instanceof Range) {
		// 	assert.equal(overloadMethod_3.location.start.line, 15, 'overloadMethod.location.start.line')
		// } else {
		// 	assert.fail('overloadMethod.location not instanceof Range')
		// }
	})

	test('proj0.22 - test coverage for class in subdirectory', async () => {
		await runTestsInFile('src/dirA/dir1/testClassInDir.cls', 1, TestRunProfileKind.Coverage)
		assert.tests.count(2)
		assert.tests.passed(2)
		assert.tests.failed(0)
	})

	test.skip('proj0.23 - destructor is not an overload', async () => {
		// await runTestsInFile('src/destructorClass.test.cls', 1, TestRunProfileKind.Coverage)
		await runTestsInFile('src/destructorClass.test.cls', 1, TestRunProfileKind.Coverage)
		const res = await getResults()

		const parents = res[0].profileJson.flatMap((p) => p.modules)
		log.info('90 parents.length=' + parents.length)
		const childModules = parents.flatMap((p) => p.childModules)
		log.info('91 chdildModules.length=' + childModules.length)

		log.info('100 ' + childModules.map(m => m.EntityName).join(', '))
		const modules = childModules.filter(m => m.EntityName == 'destructorClass')
		log.info('101')
		assert.equal(modules?.length, 2, 'modules.length')
		log.info('102')

		assert.equal(modules[0].overloaded, false, 'modules[0].overloaded')
		log.info('103')
		assert.equal(modules[0].Destructor, false, 'modules[0].Destructor')
		log.info('104')
		assert.equal(modules[1].overloaded, false, 'modules[1].overloaded')
		log.info('105')
		assert.equal(modules[1].Destructor, true, 'modules[1].Destructor')
		log.info('106')
	})

	test.skip('proj 0.24 - search propath for destructorClass.test.r', async () => {
		const res = await getResults()
		const fileinfo1 = res[0].debugLines.propath.search('destructorClass.cls')
		if (!fileinfo1) {
			assert.fail('file not found in propath: destructorClass.cls')
		}

		const fileinfo2 = res[0].debugLines.propath.search('destructorClass.test.cls')
		if (!fileinfo2) {
			assert.fail('file not found in propath: destructorClass.test.cls')
		}
		// This should the result, but the compiler has other ideas....
		// assert.equals(fileinfo2?.rcodeUri.fsPath, toUri('src/destructorClass.test.r').fsPath)
		assert.equal(fileinfo2?.rcodeUri.fsPath, toUri('src/destructorClass.r').fsPath)

		const fileinfo3 = res[0].debugLines.propath.search('destructorClass.r')
		if (!fileinfo3) {
			assert.fail('file not found in propath: destructorClass.r')
		}

		const fileinfo4 = res[0].debugLines.propath.search('destructorClass.test.r')
		if (!fileinfo4) {
			assert.fail('file not found in propath: destructorClass.test.r')
		}
		assert.equal(fileinfo4?.uri.fsPath, toUri('src/destructorClass.test.cls').fsPath)

		const fileinfo5 = res[0].debugLines.propath.search('destructorClass/test.r')
		if (!fileinfo5) {
			assert.fail('file not found in propath: destructorClass/test.r')
		}
		assert.equal(fileinfo5?.uri.fsPath, toUri('src/destructorClass.test.cls').fsPath)
	})

})
