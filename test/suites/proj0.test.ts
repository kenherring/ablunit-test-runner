import * as vscode from 'vscode'
import { DetailedCoverageCustom } from '../ExtensionImports'
import { Uri, assert, deleteFile, doesFileExist, getResults, getWorkspaceUri, log, runAllTests, sleep2, suiteSetupCommon, toUri, updateTestProfile, workspace } from '../testCommon'
log.info('LOADING ' + __filename)

function getDetailLine (coverage: DetailedCoverageCustom[], lineNum: number) {
	if (!coverage) return undefined
	return coverage.find((d) => {
		const r = d.location as vscode.Range
		return r.start.line === lineNum
	})
}

suite('proj0Suite ', () => {

	suiteSetup('proj0 - suiteSetup', suiteSetupCommon)

	setup('proj0 - setup-1', async () => {
		log.info('proj0 - setup-1')
		const prom = vscode.commands.executeCommand('testing.clearTestResults')
		log.info('proj0 - setup-2')
		deleteFile('.vscode/ablunit-test-profile.json')
		log.info('proj0 - setup-3')

		const dbUri = toUri('target/db/sp2k.db')
		log.info('proj0 - setup-4')
		log.info('dbUri=' + dbUri)
		log.info('proj0 - setup-5')
		if (!doesFileExist(dbUri)) {
			log.info('proj0 - setup-6')
			throw new Error('db file not found: ' + dbUri.fsPath + '.  Has the \'npm run pretest\' script run?')
		}
		log.info('proj0 - setup-8')
		await prom
		log.info('proj0 - setup-9')
	})

	teardown('proj0 - teardown', () => {
		log.info('proj0 - teardown-1')
		deleteFile('.vscode/ablunit-test-profile.json')
		log.info('proj0 - teardown-2')
	})

	// suiteTeardown('proj0 - suiteTeardown-1', () => {
	// 	log.info('proj0 - suiteTeardown-1')
	// })

	test('proj0.0 output files exist A', () => {
		log.info('proj0.0-1 workspaceFolder=' + workspace.workspaceFolders?.[0].uri.fsPath)
		if (!workspace.workspaceFolders![0].uri.fsPath.replace(/\\/g, '/').endsWith('test_projects/proj0')) {
			throw new Error('proj0.0 - workspaceFolder not set to proj0')
		}
		assert.assert(true)
	})

	test('proj0.1 workspaceFolder/ablunit.json file exists', async () => {
		log.info('proj0.1 - output files exist - 1')
		await runAllTests()
		log.info('getResults')
		const prom = getResults().then((recentResults) => {
			log.info('ablunit.json = ' + recentResults[0].cfg.ablunitConfig.config_uri)
			assert.equal(recentResults[0].cfg.ablunitConfig.config_uri, toUri('ablunit.json'), 'ablunit.json path mismatch')
			assert.fileExists('ablunit.json', 'results.xml')
			assert.notFileExists('results.json')
			assert.notDirExists('listings')
			log.info('resuls done proj0.1')
			return true
		})
		log.info('end proj0.1 prom=' + JSON.stringify(prom))
	})

	test('proj0.2 - run test, open file, validate coverage displays', async () => {
		log.info('start proj0.2 1')
		await runAllTests()
		log.info('start proj0.2 2')
		const testFileUri = vscode.Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		log.info('start proj0.2 3 testFileUri=' + testFileUri.fsPath)
		// await vscode.window.showTextDocument(testFileUri).then()
		log.info('start proj0.2 3.5 testFileUri=' + testFileUri.fsPath)
		log.info('start proj0.2 3.6 workspaceUri=' + getWorkspaceUri().fsPath)
		await vscode.window.showTextDocument(testFileUri).then()
		log.info('start proj0.2 4')

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath)?.detailedCoverage ?? []
		log.info('start proj0.2 5')
		assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
		log.info('start proj0.2 6')
		assert.assert(getDetailLine(lines, 5), 'line 5 should display as executed')
		log.info('start proj0.2 7')
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

	test('proj0.4 - coverage=false, open file, run test, validate no coverage displays', async () => {
		log.info('start proj0.4')
		await updateTestProfile('profiler.coverage', false)
		const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
		await vscode.window.showTextDocument(testFileUri).then()
		await runAllTests()

		const lines = (await getResults())[0].coverage.get(testFileUri.fsPath)?.detailedCoverage ?? []
		const executedLines = lines.filter((d) => d.executed)
		log.debug('executedLines.length=' + executedLines.length)
		assert.equal(0, executedLines.length, 'executed lines found for ' + workspace.asRelativePath(testFileUri) + '. should be empty')
		assert.assert(!getDetailLine(executedLines, 5), 'line 5 should display as not executed')
		assert.assert(!getDetailLine(executedLines, 6), 'line 5 should display as not executed')
		log.info('end proj0.4')
	})

})
