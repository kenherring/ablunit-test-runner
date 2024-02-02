import { after, before } from 'mocha'
import { Uri, commands, window, workspace } from 'vscode'
import { assert, deleteFile, getDecorator, getResults, log, runAllTests, sleep, toUri, updateTestProfile, waitForExtensionActive } from '../testCommon'

const projName = 'proj0'

before(async () => {
	await waitForExtensionActive().then(() => { return sleep(250) })
	await commands.executeCommand('testing.clearTestResults').then()
	deleteFile('.vscode/ablunit-test-profile.json')
})

after(() => {
	deleteFile('.vscode/ablunit-test-profile.json')
})

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

		const decorator = getDecorator()
		const lines = decorator.getDecorations(testFileUri)
		assert.assert(lines.executed, 'no executed lines found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(lines.executed!.find((d) => d.range.start.line === 5), 'line 5 should display as executed')
		assert.assert(lines.executed!.find((d) => d.range.start.line === 6), 'line 6 should display as executed')
	})

	test(projName + '.3 - open file, run test, validate coverage displays', async () => {
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri).then()
		await runAllTests()

		const decorator = getDecorator()
		const lines = decorator.getDecorations(testFileUri)
		assert.assert(lines.executed, 'no executed lines found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(lines.executed!.find((d) => d.range.start.line === 5), 'line 5 should display as executed')
		assert.assert(lines.executed!.find((d) => d.range.start.line === 6), 'line 6 should display as executed')
	})

	test(projName + '.4 - coverage=false, open file, run test, validate no coverage displays', async () => {
		await updateTestProfile('profiler.coverage', false)
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await window.showTextDocument(testFileUri).then()
		await runAllTests()

		const decorator = getDecorator()
		const lines = decorator.getDecorations(testFileUri)

		log.info('lines.executed.length=' + lines.executed?.length)
		log.info('lines.executable.length=' + lines.executable?.length)
		assert.assert(!lines.executed, 'executed lines found for ' + workspace.asRelativePath(testFileUri) + '. should be empty')
		assert.assert(!lines.executable, 'no executable lines found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(!lines.executed?.find((d) => d.range.start.line === 5), 'line 5 should display as executed')
		assert.assert(!lines.executed?.find((d) => d.range.start.line === 6), 'line 6 should display as executed')
		assert.assert(!lines.executable?.find((d) => d.range.start.line === 6), 'line 6 should display as executable')
	})

})
