import { Uri, commands, window, workspace, Range, TextEditor } from 'vscode'
import { assert, deleteFile, getResults, getWorkspaceFolders, log, runAllTests, toUri, updateTestProfile } from '../testCommon'
import { DetailedCoverageCustom } from '../../src/TestCoverage'

function getDetailLine (coverage: DetailedCoverageCustom[], lineNum: number) {
	if (!coverage) return undefined
	return coverage.find((d) => {
		const r = d.location as Range
		return r.start.line === lineNum
	})
}

suite('proj0Suite ', () => {

	suiteSetup('proj0 - before', async () => {
		await suiteSetupCommon()
		await commands.executeCommand('testing.clearTestResults')
		deleteFile('.vscode/ablunit-test-profile.json')
	})

	teardown('proj0 - teardown', () => {
		deleteFile('.vscode/ablunit-test-profile.json')
	})

	test('proj0.1 - ${workspaceFolder}/ablunit.json file exists', () => {
		return runAllTests()
			.then(() => getResults())
			.then((recentResults) => {
				assert.equal(recentResults[0].cfg.ablunitConfig.config_uri, toUri('ablunit.json'), 'ablunit.json path mismatch')
				assert.fileExists('ablunit.json', 'results.xml')
				assert.notFileExists('results.json')
				assert.notDirExists('listings')
				return true
			})
			.catch((e: unknown) => { throw e })
	})

	test('proj0.2 - run test, open file, validate coverage displays', () => {
		const testFileUri = Uri.joinPath(getWorkspaceFolders()[0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		return runAllTests()
			.then(() => {
				log.info('window.showTextDocument testFileUri=' + testFileUri.fsPath)
				return window.showTextDocument(testFileUri)
			})
			.then((editor: TextEditor) => {
				log.info('getResults (editor=' + editor.document.uri.fsPath + ')')
				return getResults()
			})
			.then((recentResults) => {
				const lines = recentResults[0].coverage.get(testFileUri.fsPath)?.detailedCoverage ?? []
				assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
				assert.assert(getDetailLine(lines, 5), 'line 5 should display as executed')
				assert.assert(getDetailLine(lines, 6), 'line 5 should display as executed')
				return true
			})
	})

	test('proj0.3 - open file, run test, validate coverage displays', async () => {
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		return window.showTextDocument(testFileUri)
			.then(() => runAllTests())
			.then(() => getResults())
			.then((recentResults) => {
				const lines = recentResults[0].coverage.get(testFileUri.fsPath)?.detailedCoverage ?? []
				assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
				assert.assert(getDetailLine(lines, 5), 'line 5 should display as executed')
				assert.assert(getDetailLine(lines, 6), 'line 5 should display as executed')
				return true
			})
	})

	test('proj0.4 - coverage=false, open file, run test, validate no coverage displays', () => {
		const testFileUri = Uri.joinPath(getWorkspaceFolders()[0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		return updateTestProfile('profiler.coverage', false)
			.then(() => window.showTextDocument(testFileUri))
			.then(() => runAllTests())
			.then(() => getResults())
			.then((recentResults) => {
				const lines = recentResults[0].coverage.get(testFileUri.fsPath)?.detailedCoverage ?? []
				const executedLines = lines.filter((d) => d.executed)
				log.debug('executedLines.length=' + executedLines.length)
				assert.equal(0, executedLines.length, 'executed lines found for ' + workspace.asRelativePath(testFileUri) + '. should be empty')
				assert.assert(!getDetailLine(executedLines, 5), 'line 5 should display as not executed')
				assert.assert(!getDetailLine(executedLines, 6), 'line 5 should display as not executed')
				return true
			})
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
