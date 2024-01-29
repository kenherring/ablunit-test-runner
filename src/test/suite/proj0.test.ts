import { assert, decorator, getRecentResults, runAllTests, toUri, waitForExtensionActive } from '../testCommon'
import { before } from 'mocha'
import { log } from '../../ChannelLogger'
import { Uri, commands, window, workspace } from 'vscode'

const projName = __filename.split('\\').pop()!.split('/').pop()!.split('.')[0]

before(async () => {
	log.debug('before start')
	await waitForExtensionActive().then()
	await commands.executeCommand('testing.clearTestResults').then()
	log.debug('before end')
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - ${workspaceFolder}/ablunit.json file exists', async () => {
		await runAllTests()

		const recentResults = getRecentResults()
		assert.equal(recentResults[0].cfg.ablunitConfig.config_uri, toUri('ablunit.json'), "ablunit.json path mismatch")
		assert.fileExists('ablunit.json', 'results.xml')
		assert.notFileExists('results.json')
		assert.notDirExists('listings')
	})

	test(projName + '.2 - open file, run test, validate coverage displays', async () => {
		await runAllTests()

		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri).then()

		const lines = decorator.getDecorations(testFileUri)
		assert.assert(lines.executed, 'no executed lines found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(lines.executed!.find((d) => d.range.start.line === 5), 'line 5 should display as executable')
		assert.assert(lines.executed!.find((d) => d.range.start.line === 6), 'line 6 should display as executable')
	})

	test(projName + '.3 - run test, open file, validate coverage displays', async () => {
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri).then()

		await runAllTests()

		const lines = decorator.getDecorations(testFileUri)
		assert.assert(lines.executed, 'no executed lines found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(lines.executed!.find((d) => d.range.start.line === 5), 'line 5 should display as executable')
		assert.assert(lines.executed!.find((d) => d.range.start.line === 6), 'line 6 should display as executable')
	})

	// done: run and open
	// done: open and run

})

// d:\ablunit-test-runner\test_projects\proj0\src\dirA\dir1\testInDir.p
// d:\ablunit-test-runner\test_projects\proj0\src\dirA\dir1\testInDir.p
