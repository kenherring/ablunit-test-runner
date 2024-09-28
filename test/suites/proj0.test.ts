import { Uri, commands, window, workspace, TestItem, FileStat } from 'vscode'
import * as vscode from 'vscode'
import { assert, deleteFile, getResults, getTestController, getTestControllerItemCount, log, refreshTests, runAllTests, runAllTestsWithCoverage, sleep, sleep2, suiteSetupCommon, toUri, updateTestProfile } from '../testCommon'
import { ABLResultsParser } from 'parse/ResultsParser'
import * as fs from 'fs'
import { readLinesFromFile } from 'parse/TestParserCommon'
import { METHODS } from 'http'


function createTempFile () {
	const tempFile = toUri('UNIT_TEST.tmp')
	return workspace.fs.writeFile(tempFile, Buffer.from(''))
		.then(() => { return tempFile })
}

suite('proj0  - Extension Test Suite', () => {

	const disposables: vscode.Disposable[] = []

	suiteSetup('proj0 - before', async () => {
		deleteFile('.vscode/ablunit-test-profile.json')
		deleteFile('src/dirA/proj10.p')
		deleteFile('src/dirA/proj11.p')
		deleteFile('UNIT_TEST.tmp')
		await suiteSetupCommon()
		await commands.executeCommand('testing.clearTestResults')
	})

	teardown('proj0 - afterEach', () => {
		// deleteFile('.vscode/ablunit-test-profile.json')
		// deleteFile('src/dirA/proj10.p')
		// deleteFile('src/dirA/proj11.p')
		// deleteFile('UNIT_TEST.tmp')
		while (disposables.length > 0) {
			const d = disposables.pop()
			if (d) {
				d.dispose()
			} else {
				log.warn('disposables.length != 0')
			}
		}
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
	test.skip('proj0.03 - open file, run test, validate coverage displays', async () => {
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
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
		const ctrl = await refreshTests()
			.then(() => { return getTestController() })

		let testClassItem: TestItem | undefined
		// find the TestItem for src/threeTestMethods.cls
		ctrl.items.forEach((item) => {
			log.info('item.label=' + item.label + '; item.id=' + item.id + '; item.uri' + item.uri)
			if (item.label === 'src') {
				item.children.forEach(element => {
					if (element.label === 'threeTestMethods') {
						testClassItem = element
					}
				})
			}
		})

		if (!testClassItem) {
			throw new Error('cannot find TestItem for src/threeTestMethods.cls')
		}

		assert.equal(testClassItem.children.size, 3, 'testClassItem.children.size should be 3')
	})

	test('proj0.06 - parse test program with expected error annotation', async () => {
		const ctrl = await refreshTests()
			.then(() => { return getTestController() })

		let testClassItem: TestItem | undefined
		// find the TestItem for src/threeTestProcedures.p
		ctrl.items.forEach((item) => {
			log.info('item.label=' + item.label + '; item.id=' + item.id + '; item.uri' + item.uri)
			if (item.label === 'src') {
				item.children.forEach(element => {
					if (element.label === 'threeTestProcedures.p') {
						testClassItem = element
					}
				})
			}
		})

		if (!testClassItem) {
			throw new Error('cannot find TestItem for src/threeTestProcedures.p')
		}
		assert.equal(testClassItem.children.size, 3, 'testClassItem.children.size should be 3')
	})

	test('proj0.07 - parse test class with skip annotation', async () => {
		const ctrl = await refreshTests()
			.then(() => { return getTestController() })

		let testClassItem: TestItem | undefined
		// find the TestItem for src/ignoreMethod.cls
		ctrl.items.forEach((item) => {
			if (item.label === 'src') {
				item.children.forEach(element => {
					if (element.label === 'ignoreMethod') {
						testClassItem = element
					}
				})
			}
		})

		if (!testClassItem) {
			throw new Error('cannot find TestItem for src/ignoreMethod.cls')
		}
		assert.equal(testClassItem.children.size, 5, 'testClassItem.children.size should be 5')
	})

	test('proj0.08 - parse test procedure with skip annotation', async () => {
		const ctrl = await refreshTests()
			.then(() => { return getTestController() })

		let testClassItem: TestItem | undefined
		// find the TestItem for src/ignoreProcedure.p
		ctrl.items.forEach((item) => {
			if (item.label === 'src') {
				item.children.forEach(element => {
					if (element.label === 'ignoreProcedure.p') {
						testClassItem = element
					}
				})
			}
		})

		if (!testClassItem) {
			throw new Error('cannot find TestItem for src/ignoreProcedure.p')
		}
		assert.equal(testClassItem.children.size, 5, 'testClassItem.children.size should be 5')
	})

	test('proj0.09 - ABLResultsParser', async () => {
		const rp = new ABLResultsParser()
		await rp.parseResults(toUri('results_test1.xml'))
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
		log.info('initializing test proj0.10A')
		const startCount = getTestControllerItemCount()
		// This event handler makes use wait for a second edit so we know that the first edit has been processed
		// Inspiration: https://github.com/microsoft/vscode/blob/main/extensions/vscode-api-tests/src/singlefolder-tests/workspace.event.test.ts#L80
		const tempFile = await createTempFile()
		disposables.push(vscode.workspace.onWillCreateFiles(e => {
			const ws = new vscode.WorkspaceEdit()
			ws.insert(tempFile, new vscode.Position(0, 0), 'onWillCreate ' + e.files.length + ' ' + e.files[0].fsPath)
			e.waitUntil(Promise.resolve(ws))
		}))

		// //// create new test program
		const edit = new vscode.WorkspaceEdit()
		edit.createFile(toUri('src/dirA/proj10.p'), { contents: Buffer.from('@Test. procedure test1: end procedure.') })
		const success = await workspace.applyEdit(edit)
		assert.ok(success)

		log.info('contents=\'' + fs.readFileSync(toUri('src/dirA/proj10.p').fsPath, 'utf8') + '\'')
		await sleep2(250)

		// validate test item increase
		const endCount = getTestControllerItemCount()
		log.info('endCount=' + endCount + '; startCount=' + startCount)
		assert.equal(endCount - startCount, 1, 'test file count delta')
		return
	})


	test('proj0.10B - Update File', async () => {
		// init test
		log.info('initializing test proj0.10A')
		await workspace.fs.writeFile(toUri('src/dirA/proj10.p'), Buffer.from('@Test. procedure test1: end procedure.'))
		const tempFile = await createTempFile()
		const startCount = await refreshTests().then(() => { return getTestControllerItemCount('ABLTestCase') })

		disposables.push(vscode.workspace.onWillCreateFiles(e => {
			const ws = new vscode.WorkspaceEdit()
			ws.insert(tempFile, new vscode.Position(0, 0), 'onWillCreate ' + e.files.length + ' ' + e.files[0].fsPath)
			e.waitUntil(Promise.resolve(ws))
		}))
		await workspace.openTextDocument(toUri('src/dirA/proj10.p'))


		// update test program
		const edit = new vscode.WorkspaceEdit()
		edit.createFile(toUri('src/dirA/proj10.p'), { overwrite: true, contents: Buffer.from('@Test. procedure test1: end procedure.\n\n@Test. procedure test2: end procedure.\n\n@Test. procedure test3: end procedure.') })
		// edit.createFile(tempFile, { overwrite: true, contents: Buffer.from('edit.create ' + tempFile.fsPath) })
		// edit.insert(tempFile, new vscode.Position(0, 0), 'edit.insert ' + tempFile.fsPath)
		const success = await workspace.applyEdit(edit)
		// assert.ok(success)
		log.info('success=' + success)
		log.info('contents=\'' + fs.readFileSync(toUri('src/dirA/proj10.p').fsPath, 'utf8') + '\'')

		// validate test items removed
		const endCount = getTestControllerItemCount('ABLTestCase')
		log.info('endCount=' + endCount + '; startCount=' + startCount)
		assert.equal(endCount - startCount, 2, 'test cases added != 2 (endCount=' + endCount + '; startCount=' + startCount + ')')
	})

	test('proj0.10C - Delete File', async () => {
		// init tests
		fs.copyFileSync(toUri('src/dirA/proj10.p.orig').fsPath, toUri('src/dirA/proj10.p').fsPath)
		const startCount = await refreshTests()
			.then(() => { return getTestControllerItemCount() })
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
		assert.equal(getTestControllerItemCount(), startCount - 2, 'after delte file count: startCount !+ test count')
		return
	})

})
