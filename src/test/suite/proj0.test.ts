import { after, before } from 'mocha'
import { DetailedCoverage, Uri, commands, Range, window, workspace, Position } from 'vscode'
import { assert, deleteFile, getResults, log, runAllTests, sleep, toUri, updateTestProfile, waitForExtensionActive } from '../testCommon'

const projName = 'proj0'

before(async () => {
	await waitForExtensionActive().then(() => { return sleep(250) })
	await commands.executeCommand('testing.clearTestResults').then()
	deleteFile('.vscode/ablunit-test-profile.json')
})

after(() => {
	deleteFile('.vscode/ablunit-test-profile.json')
})

function getDetailLine (coverage: DetailedCoverage[] = [], lineNum: number) {
	if (!coverage) return undefined
	return coverage.find((l) => {
		if (l.location instanceof Range && l.location.start.line === lineNum) {
			return true
		} else if(l.location instanceof Position && l.location.line === lineNum) {
			return true
		}
	})
}

suite(projName + ' - Extension Test Suite', () => {

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

		const lines = (await getResults())[0].testCoverage.get(testFileUri.fsPath)?.detailedCoverage
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(getDetailLine(lines, 5)?.executed, 'line 5 should display as executed')
		assert.assert(getDetailLine(lines, 6)?.executed, 'line 5 should display as executed')
	})

	test(projName + '.3 - open file, run test, validate coverage displays', async () => {
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri).then()
		await runAllTests()

		const lines = (await getResults())[0].testCoverage.get(testFileUri.fsPath)?.detailedCoverage
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(getDetailLine(lines, 5)?.executed, 'line 5 should display as executed')
		assert.assert(getDetailLine(lines, 6)?.executed, 'line 5 should display as executed')
	})

	test(projName + '.4 - coverage=false, open file, run test, validate no coverage displays', async () => {
		await updateTestProfile('profiler.coverage', false)
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri).then()
		await runAllTests()


		const lines = (await getResults())[0].testCoverage.get(testFileUri.fsPath)?.detailedCoverage

		const executedLines = lines?.filter((l) => l.executed) ?? []
		log.debug('executedLines.length=' + executedLines.length)
		assert.equal(0, executedLines.length, 'executed lines found for ' + workspace.asRelativePath(testFileUri) + '. should be empty')
		assert.assert(!getDetailLine(executedLines, 5)?.executed, 'line 5 should display as not executed')
		assert.assert(!getDetailLine(executedLines, 6)?.executed, 'line 5 should display as not executed')
	})

})
