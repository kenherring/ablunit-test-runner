import { Uri, commands, window, workspace, TestItem } from 'vscode'
import { assert, deleteFile, getResults, getTestController, getTestControllerItemCount, log, refreshTests, runAllTests, runAllTestsWithCoverage, sleep, sleep2, suiteSetupCommon, toUri, updateTestProfile } from '../testCommon'
import { ABLResultsParser } from 'parse/ResultsParser'
import * as fs from 'fs'

suite('proj0  - Extension Test Suite', () => {

	suiteSetup('proj0 - before', async () => {
		deleteFile('.vscode/ablunit-test-profile.json')
		deleteFile('src/dirA/proj10.p')
		deleteFile('src/dirA/proj11.p')
		await suiteSetupCommon()
		await commands.executeCommand('testing.clearTestResults')
	})

	teardown('proj0 - afterEach', () => {
		deleteFile('.vscode/ablunit-test-profile.json')
		deleteFile('src/dirA/proj10.p')
		deleteFile('src/dirA/proj11.p')
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

	test('proj0.10 - Create File', () => {
		return getTestControllerItemCount('ABLTestFile')
			.then((count) => {
				assert.equal(count, 44, 'initial count')
				fs.copyFileSync(toUri('src/dirA/proj10.p.orig').fsPath, toUri('src/dirA/proj10.p').fsPath)
				return
				// return workspace.fs.writeFile(toUri('src/dirA/proj10.p'), Buffer.from('@Test. procedure test1: end procedure.'))
			})
			.then(() => { return workspace.fs.stat(toUri('src/dirA/proj10.p')) })
			.then((stat) => {
				if (!stat) {
					assert.fail('file does not exist')
				}
				return sleep2(1000)
			})
			.then(() => { return sleep2(250)})
			.then(() => { return refreshTests()})
			.then(() => { return sleep2(250)})
			.then(() => { return sleep2(250)})
			.then(() => { return sleep2(250)})
			.then(() => { return sleep2(250)})
			.then(() => { return sleep2(250)})
			.then(() => { return sleep2(250)})
			.then(() => { return sleep2(250)})
			.then(() => { return sleep2(250)})
			.then(() => { return sleep2(250)})
			.then(() => { return sleep2(250)})
			.then(() => { return sleep2(250)})
			.then(() => { return getTestControllerItemCount('ABLTestFile') })
			.then((count) => {
				assert.equal(count, 46, 'final count')
				return
			})
	})

	test('proj0.11 - Update File', async () => {
		await workspace.fs.writeFile(toUri('src/dirA/proj10.p'), Buffer.from('@Test. procedure test1: end procedure.'))
		await refreshTests()
		await getTestControllerItemCount('ABLTestFile')
			.then((count) => { assert.equal(count, 46, 'initial count') })
		await workspace.fs.writeFile(toUri('src/dirA/proj10.p'), Buffer.from('@Test. procedure test1: end procedure.\n\n@Test. procedure test2: end procedure.'))
		await  refreshTests()
		assert.equal(await getTestControllerItemCount(), 47, 'final count')
		return
	})

	test('proj0.12 - Delete File', async () => {
		fs.copyFileSync(toUri('src/dirA/proj10.p.orig').fsPath, toUri('src/dirA/proj11.p').fsPath)
		await refreshTests()
		const count = await getTestControllerItemCount('ABLTestFile')
		assert.equal(count, 46, 'initial count')

		log.info('deleting src/dirA/proj11.p')
		await workspace.fs.delete(toUri('src/dirA/proj11.p'))
			.then(() => { return sleep2(500) })
		await refreshTests()
		// await commands.executeCommand('testing.viewAsList')
		// 	.then(() => { log.info('testing.viewAsList complete'); return })
		await getTestControllerItemCount('ABLTestFile')
			.then((count) => {
				assert.equal(count, 44, 'final count')
				return
			})
		// count = await refreshTests().then(() => { return getTestControllerItemCount() })
		// assert.equal(count, 44, 'final count')
	})

})
