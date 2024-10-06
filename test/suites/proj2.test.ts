import { assert, getResults, getWorkspaceUri, log, runAllTests, suiteSetupCommon, Uri, commands, workspace, beforeCommon, deleteFile, toUri, selectProfile } from '../testCommon'

const workspaceUri = getWorkspaceUri()

suite('proj2 - Extension Test Suite', () => {

	suiteSetup('proj2 - before', () => suiteSetupCommon())

	setup('proj2 - beforeEach', () => {
		deleteFile(toUri('src/compileError.cls'))
		deleteFile(toUri('.vscode/profile.json'))
		beforeCommon()
		return  workspace.fs.copy(toUri('openedge-project.bk.json'), toUri('openedge-project.json'))
	})

	teardown('proj2 - afterEach', () => {
		deleteFile(toUri('src/compileError.cls'))
		return workspace.fs.copy(toUri('openedge-project.bk.json'), toUri('openedge-project.json'))
	})

	test('proj2.1 - temp/ablunit.json file exists', async () => {
		await runAllTests().then(() => {
			const ablunitJson = Uri.joinPath(workspaceUri, 'temp', 'ablunit.json')
			assert.fileExists(ablunitJson)
		})
	})

	test('proj2.2 - call stack', () => {
		return commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'src/classes/testClass2.cls'))
			.then(() => commands.executeCommand('testing.runCurrentFile'))
			.then(() => getResults())
			.then((recentResults) => {
				log.info('recentResults = ' + recentResults + ' ' + recentResults.length)
				const tc = recentResults[0].ablResults?.resultsJson[0].testsuite?.[0].testcases?.[0]
				const mdText = tc?.failure?.callstack.items[1].markdownText
				if (!mdText) {
					assert.fail('mdText is null')
				}
				if (mdText?.includes('testClass2.cls:file:///')) {
					assert.fail('mdText should be testClasse.cls:6')
				}
				return true
			})
	})

	test('proj2.3 - run current test suite', () => {
		return commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'src/testSuite.cls'))
			.then(() => commands.executeCommand('testing.runCurrentFile'))
			.then(() => getResults())
			.then((recentResults) => {
				const res = recentResults[0].ablResults?.resultsJson[0]
				if (!res) {
					assert.fail('res is null')
				} else {
					log.info('res.errors=' + res.errors + ', res.failures=' + res.failures + ', res.passed=' + res.passed + ', res.tests=' + res.tests)
					assert.equal(1, res.errors, 'res.errors should be 1 but got ' + res.errors)
					assert.equal(3, res.failures, 'res.failures should be 3 but got ' + res.failures)
					assert.equal(5, res.passed, 'res.passed should be 5 but got ' + res.passed)
					assert.equal(9, res.tests, 'res.tests should be 9 but got ' + res.tests)
				}
				return
			})
	})

	test('proj2.4 - compile error', () => {

		return workspace.fs.copy(toUri('openedge-project.json'), toUri('openedge-project.bk.json'))
			.then(() => workspace.fs.writeFile(toUri('src/compileError.cls'), Buffer.from('@Test.\nprocedure compileErrorProd :\nthis doen not compile\nend procedure.')))
			.then(() => runAllTests())
			.then(() => {
				throw new Error('test should have failed due to compile error')
			}, (e) => {
				log.info('e=' + e)
				assert.ok('test failed as expected')
				return true
			})
	})

	test('proj2.5 - compile error excluded', () => {

		return workspace.fs.copy(toUri('openedge-project.json'), toUri('openedge-project.bk.json'))
			.then(() => workspace.fs.writeFile(toUri('src/compileError.cls'), Buffer.from('@Test.\nprocedure compileErrorProd :\nthis doen not compile\nend procedure.')))
			.then(() => selectProfile('exlcudeFileProfile'))
			.then(() => runAllTests())
			.then(() => {
				assert.ok('test passed as expected')
				assert.tests.count(1)
				return
			}, (e) => {
				throw new Error('test should have passed, but threw error e=' + e)
			})
	})

})
