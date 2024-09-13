import { Selection, commands, window } from 'vscode'
import { after, afterEach, beforeEach } from 'mocha'
import { Uri, assert, getWorkspaceUri, log, runAllTests, sleep, updateConfig, getTestCount, workspace, suiteSetupCommon, getWorkspaceFolders, oeVersion, runTestAtLine, beforeCommon, updateTestProfile } from '../testCommon'
import { getOEVersion } from 'parse/OpenedgeProjectParser'
import { execSync } from 'child_process'
import * as glob from 'glob'

const workspaceUri = getWorkspaceUri()

suite('proj1 - Extension Test Suite', () => {

	suiteSetup('proj1 - suiteSetup', async () => {
		await suiteSetupCommon()
			.then(() => { return workspace.fs.copy(Uri.joinPath(workspaceUri, 'openedge-project.json'), Uri.joinPath(workspaceUri, 'openedge-project.bk.json'), { overwrite: true }) })
			.then(() => { return workspace.fs.copy(Uri.joinPath(workspaceUri, '.vscode', 'ablunit-test-profile.json'), Uri.joinPath(workspaceUri, '.vscode', 'ablunit-test-profile.bk.json'), { overwrite: true }) })
			.then(() => { return workspace.fs.copy(Uri.joinPath(workspaceUri, '.vscode', 'settings.json'), Uri.joinPath(workspaceUri, '.vscode', 'settings.bk.json'), { overwrite: true }) })
	})

	beforeEach('proj1 - beforeEach', async () => {
		beforeCommon()
		log.info('setup-2 has(ablunit.files)=' + workspace.getConfiguration('ablunit').has('files') + ' files.exclude=' + workspace.getConfiguration('ablunit').get('files.exclude'))
		// const prom = workspace.getConfiguration('ablunit').update('files.exclude', undefined)
		return workspace.getConfiguration('ablunit.files').update('exclude', undefined)
	})

	afterEach('proj1 - afterEach', async () => {
		await workspace.fs.copy(Uri.joinPath(workspaceUri, 'openedge-project.bk.json'), Uri.joinPath(workspaceUri, 'openedge-project.json'), { overwrite: true })
			.then(() => { return workspace.fs.copy(Uri.joinPath(workspaceUri, '.vscode', 'ablunit-test-profile.bk.json'), Uri.joinPath(workspaceUri, '.vscode', 'ablunit-test-profile.json'), { overwrite: true }) })
			.then(() => { return workspace.fs.copy(Uri.joinPath(workspaceUri, '.vscode', 'settings.bk.json'), Uri.joinPath(workspaceUri, '.vscode', 'settings.json'), { overwrite: true })
			}, (e) => { throw e })
	})

	after('proj1 - suiteTeardown', async () => {
		return workspace.fs.delete(Uri.joinPath(workspaceUri, 'openedge-project.bk.json'))
			.then(() => { return workspace.fs.delete(Uri.joinPath(workspaceUri, '.vscode', 'ablunit-test-profile.bk.json')) })
			.then(() => { return workspace.fs.delete(Uri.joinPath(workspaceUri, '.vscode', 'settings.bk.json')) })
	})

	test('proj1.1 - output files exist 1 - compile error', () => {
		const ablunitJson = Uri.joinPath(workspaceUri, 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceUri, 'results.xml')
		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		assert.notFileExists(ablunitJson)
		assert.notFileExists(resultsXml)

		const prom = runAllTests()
			.then(() => {
				throw new Error('runAllTests should have thrown an error')
			}, (e: unknown) => {
				log.info('runAllTests error: ' + e)
				assert.fileExists(ablunitJson)
				const wsFolder = getWorkspaceFolders()[0]
				log.info('getOEVersion(wsFolder)=' + getOEVersion(wsFolder) + '; oeVersion()=' + oeVersion())
				if (oeVersion()?.startsWith('12.2') && (process.platform === 'win32' || process.env['WSL_DISTRO_NAME'] !== undefined)) {
					assert.fileExists(resultsXml)
				} else {
					assert.notFileExists(resultsXml)
				}
				assert.notFileExists(resultsJson)
				log.info('assert proj1.1 complete!')
			})
		return prom
	})

	test('proj1.2 - output files exist 2 - exclude compileError.p', () => {
		return workspace.getConfiguration('ablunit').update('files.exclude', [ '.builder/**', 'compileError.p' ])
			.then(() => { return runAllTests() })
			.then(() => {
				assert.tests.count(17)
				assert.tests.passed(11)
				assert.tests.failed(2)
				assert.tests.errored(3)
				assert.tests.skipped(1)
				return true
			}, (e) => { throw e })

	})

	test('proj1.3 - output files exist 3 - exclude compileError.p as string', async () => {
		// this isn't officially supported and won't syntac check in the settings.json file(s), but it works
		await updateConfig('ablunit.files.exclude', 'compileError.p')
		await runAllTests()

		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		const testCount = await getTestCount(resultsJson)
		assert.equal(testCount, 17)
	})

	test('proj1.4 - run test case in file', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'procedureTest.p'))
		await sleep(200)
		await commands.executeCommand('testing.runCurrentFile')

		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		const testCount: number = await getTestCount(resultsJson)
		const pass = await getTestCount(resultsJson, 'pass')
		const fail = await getTestCount(resultsJson, 'fail')
		const error = await getTestCount(resultsJson, 'error')
		assert.equal(6, testCount, 'test count')
		assert.equal(2, pass, 'pass count')
		assert.equal(2, fail, 'fail count')
		assert.equal(2, error, 'error count')
	})

	test('proj1.5 - run test case at cursor', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri, 'procedureTest.p'))
		if(window.activeTextEditor) {
			window.activeTextEditor.selection = new Selection(21, 0, 21, 0)
		} else {
			assert.fail('vscode.window.activeTextEditor is undefined')
		}
		await commands.executeCommand('testing.runAtCursor')

		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		const testCount = await getTestCount(resultsJson)
		const pass = await getTestCount(resultsJson, 'pass')
		const fail = await getTestCount(resultsJson, 'fail')
		const error = await getTestCount(resultsJson, 'error')
		assert.equal(1, testCount)
		assert.equal(1, pass)
		assert.equal(0, fail)
		assert.equal(0, error)
	})

	test('proj1.6 - read file with UTF-8 chars', async () => {
		await runTestAtLine('import_charset.p', 14)
			.then(() => {
				log.info('testing.runAtCursor complete')
				assert.tests.count(1)
				assert.tests.passed(1)
				assert.tests.failed(0)
				assert.tests.errored(0)
			})
	})

	test('proj1.7 - read file with UTF-8 chars (charset as extra param)', async () => {
		await workspace.fs.copy(Uri.joinPath(workspaceUri, 'openedge-project.proj1.7.json'), Uri.joinPath(workspaceUri, 'openedge-project.json'), { overwrite: true })
		await runTestAtLine('import_charset.p', 14)
			.then(() => {
				log.info('testing.runAtCursor complete')
				assert.tests.count(1)
				assert.tests.passed(1)
				assert.tests.failed(0)
				assert.tests.errored(0)
			})
	})

	test('proj1.8 - update charset to ISO8559-1, then read file with UTF-8 chars', async () => {
		await workspace.fs.copy(Uri.joinPath(workspaceUri, 'openedge-project.proj1.8.json'), Uri.joinPath(workspaceUri, 'openedge-project.json'), { overwrite: true })
		await runTestAtLine('import_charset.p', 14)
			.then(() => {
				log.info('testing.runAtCursor complete')
				assert.tests.count(1)
				assert.tests.passed(0)
				assert.tests.failed(1)
				assert.tests.errored(0)
			})
	})

	test('proj1.9 - check startup parmaeters for -y -yx', async () => {
		await workspace.fs.copy(Uri.joinPath(workspaceUri, 'openedge-project.proj1.9.json'), Uri.joinPath(workspaceUri, 'openedge-project.json'), { overwrite: true })
		await runTestAtLine('import_charset.p', 64)
			.then(() => {
				log.info('testing.runAtCursor complete')
				assert.tests.count(1)
				assert.tests.passed(0)
				assert.tests.failed(1)
				assert.tests.errored(0)
			})
	})

	test('proj1.10 - xref options', async () => {

		if (oeVersion() < '12.5') {
			log.info('skipping proj1.10 - xref options for ablunit config not available prior to 12.5')
			return
		}

		// setup test configuration
		await workspace.fs.copy(Uri.joinPath(workspaceUri, 'openedge-project.proj1.10.json'), Uri.joinPath(workspaceUri, 'openedge-project.json'), { overwrite: true })
			.then(() => { return workspace.fs.copy(Uri.joinPath(workspaceUri, '.vscode', 'ablunit-test-profile.proj1.10.json'), Uri.joinPath(workspaceUri, '.vscode', 'ablunit-test-profile.json'), { overwrite: true }) })
			.then(() => { return workspace.getConfiguration('ablunit').update('files.exclude', [ '.builder/**', 'compileError.p', 'propathTest.p' ]) })
			.then(() => { log.info('test proj1.10 config setup complete') })

		// delete all *.xref files in the root
		let xrefFiles = glob.globSync('*.xref', { cwd: workspaceUri.fsPath })
		log.info('xrefFiles.length=' + xrefFiles.length)
		for (const xrefFile of xrefFiles) {
			log.info('deleting ' + xrefFile)
			await workspace.fs.delete(Uri.joinPath(workspaceUri, xrefFile))
		}
		xrefFiles = glob.globSync('*.xref', { cwd: workspaceUri.fsPath })
		assert.equal(xrefFiles.length, 0, 'xref files should not exist (before)')

		xrefFiles = glob.globSync('*.xref', { cwd: workspaceUri.fsPath })
		assert.equal(xrefFiles.length, 0, 'xref files should not exist')

		// update ablunit-test-profile.json to include xref options.
		await updateTestProfile('xref', { 'useXref': true, 'xrefLocation': '${workspaceFolder}/.builder/pct0', 'xrefExtension': 'xref', 'xrefThrowError': true })

		// compile with xref xml output
		log.info('execSync start')
		if (process.env['DLC'] == '/psc/dlc') {
			execSync('ant', { cwd: getWorkspaceUri().fsPath })
		} else {
			execSync(process.env['DLC']?.replace(/\\/g, '/') + '/ant/bin/ant', { cwd: getWorkspaceUri().fsPath })
		}
		log.info('execSync end')

		// run tests and assert test count
		await runAllTests()
			.then(() => {
				assert.tests.count(16)
				assert.tests.passed(10)
				assert.tests.failed(2)
				assert.tests.errored(3)
				assert.tests.skipped(1)
			})
		xrefFiles = glob.globSync('*.xref', { cwd: workspaceUri.fsPath })
		assert.equal(xrefFiles.length, 0, 'xref files should not exist!  count=' + xrefFiles.length + ' (after)')
	})

})
