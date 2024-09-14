import { Uri, commands, window, workspace, FileCoverageDetail, TestItem, Position } from 'vscode'
import { assert, deleteFile, getResults, getTestController, log, refreshTests, runAllTests, runAllTestsWithCoverage, suiteSetupCommon, toUri, updateTestProfile } from '../testCommon'
import { ABLResultsParser } from 'parse/ResultsParser'

suite('proj0  - Extension Test Suite', () => {

	suiteSetup('proj0 - before', async () => {
		await suiteSetupCommon()
		await commands.executeCommand('testing.clearTestResults')
		deleteFile('.vscode/ablunit-test-profile.json')
	})

	teardown('proj0 - afterEach', () => {
		deleteFile('.vscode/ablunit-test-profile.json')
	})

	test('proj0.1 - ${workspaceFolder}/ablunit.json file exists', () => {
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

	test('proj0.2 - run test, open file, validate coverage displays', async () => {
		await runAllTestsWithCoverage()
			.then(() => { assert.linesExecuted('src/dirA/dir1/testInDir.p', [5, 6]) })
	})

	// is it possible to validate the line coverage displayed and not just the reported coverage?  does it matter?
	test.skip('proj0.3 - open file, run test, validate coverage displays', async () => {
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri)
		await runAllTestsWithCoverage()

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath) ?? []
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.linesExecuted(testFileUri, [5, 6])
	})

	test('proj0.4 - coverage=false, open file, run test, validate no coverage displays', async () => {
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

	test('proj0.5 - parse test class with expected error annotation', async () => {
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

	test('proj0.6 - parse test program with expected error annotation', async () => {
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

	test('proj0.7 - parse test class with skip annotation', async () => {
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

	test('proj0.8 - parse test procedure with skip annotation', async () => {
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

	test('proj0.9 - ABLResultsParser', async () => {
		const rp = new ABLResultsParser()
		await rp.parseResults(toUri('results_test1.xml'))
			.then(() => {
				log.info('parsed results_test1.xml successfully')
			}, (e: unknown) => {
				if (e instanceof Error) {
					log.info('e.message=' + e.message)
					log.info('e.stack=' + e.stack)
				}
				assert.fail('error parsing results_test1.xml: ' + e)
			})
	})

})
