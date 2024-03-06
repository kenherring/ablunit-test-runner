import { afterEach, before } from 'mocha'
import { Uri, commands, window, workspace, Range } from 'vscode'
import { assert, deleteFile, getResults, log, runAllTests, sleep, toUri, updateTestProfile, waitForExtensionActive } from '../testCommon'
import { DetailedCoverageCustom } from '../../TestCoverage'

const projName = 'proj0'

function getDetailLine (coverage: DetailedCoverageCustom[], lineNum: number) {
	if (!coverage) return undefined
	return coverage.find((d) => {
		const r = d.location as Range
		return r.start.line === lineNum
	})
}

suite(projName + ' - Extension Test Suite', () => {

	before(projName + ' - before', async () => {
		await waitForExtensionActive().then(async () => { return sleep(250) })
		await commands.executeCommand('testing.clearTestResults').then()
		deleteFile('.vscode/ablunit-test-profile.json')
	})

	afterEach(projName + ' - afterEach', () => {
		deleteFile('.vscode/ablunit-test-profile.json')
	})

	test(projName + '.1 - ${workspaceFolder}/ablunit.json file exists', async () => {
		await runAllTests()

		const recentResults = await getResults()
		assert.equal(recentResults[0].cfg.ablunitConfig.config_uri, toUri('ablunit.json'), 'ablunit.json path mismatch')
		assert.fileExists('ablunit.json', 'results.xml')
		assert.notFileExists('results.json')
		assert.notDirExists('listings')
	})

	test(projName + '.2 - run test, open file, validate coverage displays', async () => {
		await runAllTests()
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri).then()

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath)?.detailedCoverage ?? []
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(getDetailLine(lines, 5), 'line 5 should display as executed')
		assert.assert(getDetailLine(lines, 6), 'line 5 should display as executed')
	})

	test(projName + '.3 - open file, run test, validate coverage displays', async () => {
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri).then()
		await runAllTests()

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath)?.detailedCoverage ?? []
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(getDetailLine(lines, 5), 'line 5 should display as executed')
		assert.assert(getDetailLine(lines, 6), 'line 5 should display as executed')
	})

	test(projName + '.4 - coverage=false, open file, run test, validate no coverage displays', async () => {
		await updateTestProfile('profiler.coverage', false)
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri).then()
		await runAllTests()

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath)?.detailedCoverage ?? []
		const executedLines = lines.filter((d) => d.executed)
		log.debug('executedLines.length=' + executedLines.length)
		assert.equal(0, executedLines.length, 'executed lines found for ' + workspace.asRelativePath(testFileUri) + '. should be empty')
		assert.assert(!getDetailLine(executedLines, 5), 'line 5 should display as not executed')
		assert.assert(!getDetailLine(executedLines, 6), 'line 5 should display as not executed')
	})

})
