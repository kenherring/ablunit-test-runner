import { Uri, commands, window, workspace, Range, FileCoverageDetail, TestItem } from 'vscode'
import { assert, deleteFile, getResults, getTestController, log, refreshTests, runAllTests, runAllTestsWithCoverage, suiteSetupCommon, toUri, updateTestProfile } from '../testCommon'

function getDetailLine (coverage: FileCoverageDetail[] | never[], lineNum: number) {
	if (!coverage) return undefined
	if (coverage.length === 0) {
		return undefined
	}
	if (coverage.length >= 1) {
		return coverage.find((d: FileCoverageDetail) => {
			log.info('found line!')
			const r = d.location as Range
			return r.start.line === lineNum
		})
	}
	return 0
	// throw new Error('unexpected coverage length')
}

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

	// TODO - fix before merge

	test('proj0.2 - run test, open file, validate coverage displays', async () => {
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		const res = await runAllTestsWithCoverage()
			.then(() => { return window.showTextDocument(testFileUri) })
			.then(() => { return getResults() })
			.catch((e: unknown) => { throw e })

		if (!res || res.length === 0) {
			assert.fail('getResults returned undefined')
			return
		}
		if (res.length > 1) {
			assert.fail('getResults returned more than one result')
			return
		}

		const results = res[0]
		if (results.coverage.size === 0) {
			assert.fail('no coverage found')
			return
		}
		const lines = results.coverage.get(testFileUri.fsPath)
		if (!lines || lines.length === 0) {
			assert.fail('no coverage found for ' + workspace.asRelativePath(testFileUri))
			// throw new Error('no coverage found for ' + workspace.asRelativePath(testFileUri))
			return
		}
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(getDetailLine(lines, 5), 'line 5 should display as executed')
		assert.assert(getDetailLine(lines, 6), 'line 6 should display as executed')
	})

	test('proj0.3 - open file, run test, validate coverage displays', async () => {
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri)
		await runAllTestsWithCoverage()

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath) ?? []
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(getDetailLine(lines, 5), 'line 5 should display as executed')
		assert.assert(getDetailLine(lines, 6), 'line 5 should display as executed')
	})

	test('proj0.4 - coverage=false, open file, run test, validate no coverage displays', async () => {
		await updateTestProfile('profiler.coverage', false)
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri)
		await runAllTests()

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath) ?? []
		const executedLines = lines.filter((d) => d)
		log.debug('executedLines.length=' + executedLines.length)
		assert.equal(0, executedLines.length, 'executed lines found for ' + workspace.asRelativePath(testFileUri) + '. should be empty')
		assert.assert(!getDetailLine(executedLines, 5), 'line 5 should display as not executed')
		assert.assert(!getDetailLine(executedLines, 6), 'line 5 should display as not executed')
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

})
