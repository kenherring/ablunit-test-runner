import * as vscode from 'vscode'
import { DetailedCoverageCustom } from '../ExtensionImports'
import { Uri, assert, deleteFile, doesFileExist, getResults, log, runAllTests, sleep, sleep2, toUri, updateTestProfile, waitForExtensionActive, workspace } from '../testCommon'
log.info('LOADING ' + __filename)

function getDetailLine (coverage: DetailedCoverageCustom[], lineNum: number) {
	if (!coverage) return undefined
	return coverage.find((d) => {
		const r = d.location as vscode.Range
		return r.start.line === lineNum
	})
}

suite('proj0Suite ', () => {

	suiteSetup('proj0 - suiteSetup', async () => {
		await waitForExtensionActive()
		await vscode.commands.executeCommand('testing.clearTestResults').then()
	})

	setup('proj0 - setup-1', () => {
		deleteFile('.vscode/ablunit-test-profile.json')

		const dbUri = toUri('target/db/sp2k.db')
		log.info('dbUri=' + dbUri)
		if (!doesFileExist(dbUri)) {
			throw new Error('db file not found: ' + dbUri.fsPath + '.  Has the \'npm run pretest\' script run?')
		}
	})

	setup('proj0 - setup-2', () => {
		log.info('proj0-setup-1 workspaceFolders.length=' + workspace.workspaceFolders?.length)
		for (const f of workspace.workspaceFolders ?? []) {
			log.info('proj0-setup-1a workspaceFolder=' + f.uri.fsPath)
		}
	})

	teardown('proj0 - teardown', () => {
		log.info('proj0 - teardown')
	})

	suiteTeardown('proj0 - suiteTeardown-1', () => {
		log.info('proj0 - suiteTeardown-1')
		deleteFile('.vscode/ablunit-test-profile.json')
	})

	test('proj0.0 output files exist A', () => {
		log.info('proj0.0-1 workspaceFolder=' + workspace.workspaceFolders?.[0].uri.fsPath)
		if (!workspace.workspaceFolders![0].uri.fsPath.replace(/\\/g, '/').endsWith('test_projects/proj0')) {
			throw new Error('proj0.0 - workspaceFolder not set to proj0')
		}
		assert.assert(true)
	})

	test('proj0.1 _workspaceFolder_/ablunit.json file exists', async () => {
		log.info('proj0.1 - output files exist - 1')
		await sleep2()
		log.info('start proj0.1')
		await runAllTests()
		log.info('getResults')
		const recentResults = await getResults()
		log.info('ablunit.json = ' + recentResults[0].cfg.ablunitConfig.config_uri)
		assert.equal(recentResults[0].cfg.ablunitConfig.config_uri, toUri('ablunit.json'), 'ablunit.json path mismatch')
		assert.fileExists('ablunit.json', 'results.xml')
		assert.notFileExists('results.json')
		assert.notDirExists('listings')
		log.info('end proj0.1')
	})

	test('proj0.2 - run test, open file, validate coverage displays', async () => {
		log.info('start proj0.2')
		await runAllTests()
		const testFileUri = vscode.Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await vscode.window.showTextDocument(testFileUri).then()

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath)?.detailedCoverage ?? []
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(getDetailLine(lines, 5), 'line 5 should display as executed')
		assert.assert(getDetailLine(lines, 6), 'line 5 should display as executed')
		log.info('end proj0.2')
	})

	test('proj0.3 - open file, run test, validate coverage displays', async () => {
		log.info('start proj0.3')
		const testFileUri = vscode.Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await vscode.window.showTextDocument(testFileUri).then()
		await runAllTests()

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath)?.detailedCoverage ?? []
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		assert.assert(getDetailLine(lines, 5), 'line 5 should display as executed')
		assert.assert(getDetailLine(lines, 6), 'line 5 should display as executed')
		log.info('end proj0.3')
	})

	// test('proj0.4 - coverage=false, open file, run test, validate no coverage displays', async () => {
	// 	log.info('start proj0.4')
	// 	await updateTestProfile('profiler.coverage', false)
	// 	const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
	// 	await vscode.window.showTextDocument(testFileUri).then()
	// 	await runAllTests()

	// 	const lines = (await getResults())[0].coverage.get(testFileUri.fsPath)?.detailedCoverage ?? []
	// 	const executedLines = lines.filter((d) => d.executed)
	// 	log.debug('executedLines.length=' + executedLines.length)
	// 	assert.equal(0, executedLines.length, 'executed lines found for ' + workspace.asRelativePath(testFileUri) + '. should be empty')
	// 	assert.assert(!getDetailLine(executedLines, 5), 'line 5 should display as not executed')
	// 	assert.assert(!getDetailLine(executedLines, 6), 'line 5 should display as not executed')
	// 	log.info('end proj0.4')
	// })
})
