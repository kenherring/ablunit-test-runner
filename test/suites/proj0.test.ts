import { Uri, commands, window, workspace, Range, TextEditor } from 'vscode'
import { assert, deleteFile, getResults, getWorkspaceFolders, log, runAllTests, sleep, toUri, updateTestProfile, waitForExtensionActive } from '../testCommon'
import { DetailedCoverageCustom } from '../../src/TestCoverage'

function getDetailLine (coverage: DetailedCoverageCustom[], lineNum: number) {
	if (!coverage) return undefined
	return coverage.find((d) => {
		const r = d.location as Range
		return r.start.line === lineNum
	})
}

suite('proj0  - Extension Test Suite', () => {

	suiteSetup('proj0 - before', async () => {
		await waitForExtensionActive().then(() => sleep(250))
		await commands.executeCommand('testing.clearTestResults')
		deleteFile('.vscode/ablunit-test-profile.json')
	})

	teardown('proj0 - afterEach', () => {
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

	test('proj0.3 - open file, run test, validate coverage displays', () => {
		const testFileUri = Uri.joinPath(getWorkspaceFolders()[0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
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

})
