import { assert, getResults, getWorkspaceUri, log, runAllTests, suiteSetupCommon, Uri, commands, beforeCommon, toUri, selectProfile, runTestsInFile } from '../testCommon'
import * as FileUtils from '../../src/FileUtils'

const workspaceUri = getWorkspaceUri()

suite('proj2 - Extension Test Suite', () => {

	suiteSetup('proj2 - before', async () => {
		await suiteSetupCommon()
	})

	setup('proj2 - beforeEach', () => {
		beforeCommon()
		FileUtils.deleteFile(toUri('src/compileError.p'))
		FileUtils.deleteFile(toUri('.vscode/profile.json'))
	})

	test('proj2.1 - temp/ablunit.json file exists', () => {
		return runAllTests().then(() => {
			const ablunitJson = Uri.joinPath(workspaceUri, 'temp', 'ablunit.json')
			assert.fileExists(ablunitJson)
			return true
		})
	})

	test('proj2.2 - call stack', () => {
		return commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'src/classes/testClass2.cls'))
			.then(() => commands.executeCommand('testing.runCurrentFile'))
			.then(() => getResults())
			.then((recentResults) => {
				log.info('recentResults = ' + recentResults + ' ' + recentResults.length)
				const tc = recentResults[0].ablResults?.resultsJson[0].testsuite?.[0].testcases?.[0]
				const mdText = tc?.failures?.[0].callstack.items[1].markdownText
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
				return true
			})
	})

	test('proj2.4 - compile error - run all tests', () => {
		FileUtils.copyFile(
			toUri('src/compileError.p.saveme'),
			toUri('src/compileError.p'),
			{ force: true })

		return runAllTests()
			.then(() => {
				throw new Error('test should have failed due to compile error')
			}, (e: unknown) => {
				log.info('e=' + e)
				assert.ok('test failed as expected')
				return true
			})
	})

	test('proj2.5 - compile error - run tests in file', () => {
		FileUtils.copyFile(
			toUri('src/compileError.p.saveme'),
			toUri('src/compileError.p'),
			{ force: true }
		)
		return runTestsInFile('src/compileError.p')
			.then(() => {
				throw new Error('test should have failed due to compile error')
			}, (e: unknown) => {
				log.info('e=' + e)
				assert.ok('tests failed as expected')
				return true
			})
	})

	test('proj2.6 - compile error - run with db conn', () => {
		FileUtils.copyFile(
			toUri('src/compileError.p.saveme'),
			toUri('src/compileError.p'),
			{ force: true }
		)

		return selectProfile('profileWithDBConn')
			.then(() => runTestsInFile('src/compileError.p'))
			.then(() => {
				assert.ok('test passed as expected')
				assert.tests.count(1)
				return
			}, (e: unknown) => {
				throw new Error('test should have passed, but threw error e=' + e)
			})
	})

})
