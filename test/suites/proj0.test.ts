import { Uri, commands, window, workspace, Range, TextEditor, FileCoverageDetail } from 'vscode'
import { assert, deleteFile, getResults, getWorkspaceFolders, log, runAllTests, sleep, toUri, updateTestProfile } from '../testCommon'

const projName = 'proj0'

function getDetailLine (coverage: FileCoverageDetail[] | never[], lineNum: number) {
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
		deleteFile('.vscode/ablunit-test-profile.json')
		await commands.executeCommand('testing.clearTestResults')
		return
		// log.info('100')
		// suiteSetupCommon().then(() => {
		// 	log.info('101')
		// 	done()
		// 	log.info('102')
		// }, (e) => {
		// 	log.info('103')
		// 	done(e)
		// 	log.info('104')
		// })
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

	// TODO - fix before merge !!!

	// test('proj0.2 - run test, open file, validate coverage displays', async () => {
	// 	await runAllTests()
	// 	const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
	// 	await window.showTextDocument(testFileUri).then()

	// 	const lines = (await getResults())[0].coverage.get(testFileUri.fsPath) ?? []
	// 	assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
	// 	assert.assert(getDetailLine(lines, 5), 'line 5 should display as executed')
	// 	assert.assert(getDetailLine(lines, 6), 'line 5 should display as executed')
	// })

	// test('proj0.3 - open file, run test, validate coverage displays', async () => {
	// 	const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
	// 	await window.showTextDocument(testFileUri).then()
	// 	await runAllTests()

	// 	const lines = (await getResults())[0].coverage.get(testFileUri.fsPath) ?? []
	// 	assert.assert(lines, 'no coverage found for ' + workspace.asRelativePath(testFileUri))
	// 	assert.assert(getDetailLine(lines, 5), 'line 5 should display as executed')
	// 	assert.assert(getDetailLine(lines, 6), 'line 5 should display as executed')
	// })

	// test('proj0.4 - coverage=false, open file, run test, validate no coverage displays', async () => {
	// 	await updateTestProfile('profiler.coverage', false)
	// 	const testFileUri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'src', 'dirA', 'dir1', 'testInDir.p')
	// 	await window.showTextDocument(testFileUri).then()
	// 	await runAllTests()

	// 	const lines = (await getResults())[0].coverage.get(testFileUri.fsPath) ?? []
	// 	const executedLines = lines.filter((d) => d)
	// 	log.debug('executedLines.length=' + executedLines.length)
	// 	assert.equal(0, executedLines.length, 'executed lines found for ' + workspace.asRelativePath(testFileUri) + '. should be empty')
	// 	assert.assert(!getDetailLine(executedLines, 5), 'line 5 should display as not executed')
	// 	assert.assert(!getDetailLine(executedLines, 6), 'line 5 should display as not executed')
	// })

})
