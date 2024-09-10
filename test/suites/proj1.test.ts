import { FileType, Selection, commands, window } from 'vscode'
import { afterEach, beforeEach } from 'mocha'
import { Uri, assert, deleteTestFiles, getWorkspaceUri, log, runAllTests, sleep, updateConfig, getTestCount, workspace, suiteSetupCommon, getWorkspaceFolders, oeVersion, runTestAtLine, beforeCommon } from '../testCommon'
import { getOEVersion } from 'parse/OpenedgeProjectParser'

const workspaceUri = getWorkspaceUri()

suite('proj1 - Extension Test Suite', () => {

	suiteSetup('proj1 - suiteSetup', async () => {
		await suiteSetupCommon()
			.then(() => {
				return workspace.fs.copy(Uri.joinPath(workspaceUri, 'openedge-project.json'), Uri.joinPath(workspaceUri, 'openedge-project.bk.json'), { overwrite: true })
			})
	})

	beforeEach('proj1 - beforeEach', async () => {
		beforeCommon()
		log.info('setup-2 has(ablunit.files)=' + workspace.getConfiguration('ablunit').has('files') + ' files.exclude=' + workspace.getConfiguration('ablunit').get('files.exclude'))
		// const prom = workspace.getConfiguration('ablunit').update('files.exclude', undefined)
		return workspace.getConfiguration('ablunit.files').update('exclude', undefined)
	})

	afterEach('proj1 - afterEach', async () => {
		await workspace.fs.stat(Uri.joinPath(workspaceUri, 'openedge-project.bk.json'))
			.then((stat) => {
				if (stat.type === FileType.File) {
					return workspace.fs.copy(Uri.joinPath(workspaceUri, 'openedge-project.bk.json'), Uri.joinPath(workspaceUri, 'openedge-project.json'), { overwrite: true })
				}
				return
			})
			.then(() => { log.info('restored openedge-project.json') }, (e) => { log.error('error restoring openedge-project.json: ' + e) })
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
				assert.tests.count(16)
				log.info('proj1.2 complete!')
				return true
			}, (e) => { throw e })
	})

	test('proj1.3 - output files exist 3 - exclude compileError.p as string', async () => {
		// this isn't officially supported and won't syntac check in the settings.json file(s), but it works
		await updateConfig('ablunit.files.exclude', 'compileError.p')
		await runAllTests()

		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		const testCount = await getTestCount(resultsJson)
		assert.equal(testCount, 16)
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

	test('proj1.7 - update charset to ISO8559-1, then read file with UTF-8 chars', async () => {
		await workspace.fs.copy(Uri.joinPath(workspaceUri, 'openedge-project.proj1.7.json'), Uri.joinPath(workspaceUri, 'openedge-project.json'), { overwrite: true })
		await runTestAtLine('import_charset.p', 14)
			.then(() => {
				log.info('testing.runAtCursor complete')
				assert.tests.count(1)
				assert.tests.passed(0)
				assert.tests.failed(1)
				assert.tests.errored(0)
			})
	})

})
