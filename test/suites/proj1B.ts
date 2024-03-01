import { assert, deleteTestFiles, getTestCount, getWorkspaceUri, log, runAllTests, suiteSetupCommon, updateConfig, setFilesExcludePattern, workspace, Uri, commands, window, Selection, newTruePromise, isoDate, extensions } from '../testCommon'
log.info('LOADING ' + __filename)

async function unsetAblunitConfig (section: string) {
	log.info(isoDate() + ' proj1 - unsetAblunitConfig-0')
	const ext = extensions.getExtension('kherring.ablunit-test-runner')
	if (!ext?.isActive) {
		log.error('kherring.ablunit-test-runner is not active')
		throw new Error('kherring.ablunit-test-runner is not active')
	}

	log.info(isoDate() + ' proj1 - unsetAblunitConfig-1')
	const conf = workspace.getConfiguration('ablunit')
	log.info(isoDate() + ' proj1 - unsetAblunitConfig-2')
	if (conf.has(section)) {
		log.info(isoDate() + ' proj1 - unsetAblunitConfig-3')
		const currentValue = conf.get(section)
		const defaultValue = conf.inspect(section)?.defaultValue
		log.info('unset configuration ablunit.files.exclude')
		log.info('-- currentValue=' + JSON.stringify(currentValue))
		log.info('-- defaultValue=' + JSON.stringify(defaultValue))
		if (JSON.stringify(currentValue) !== JSON.stringify(defaultValue)) {
			log.info(isoDate() + ' await conf.update start')
			await conf.update(section, defaultValue)
			log.info(isoDate() + ' await conf.update complete')
		}
		log.info(isoDate() + ' proj1 - unsetAblunitConfig-7')
	}
	log.info(isoDate() + ' proj1 - unsetAblunitConfig-8 complete')
}

suite('proj1Suite', () => {

	suiteSetup('proj1 - suiteSetup', suiteSetupCommon)

	setup('proj1 - setup', () => {
		log.info(new Date().toISOString() + ' proj1.setup.1')
		deleteTestFiles()
		log.info(new Date().toISOString() + ' proj1.setup.2')
		// return unsetAblunitConfig('files.exclude')
		// await unsetAblunitConfig('files.exclude')
		unsetAblunitConfig('files.exclude').then(() => { log.info('unsetAblunitConfig complete') }, (e) => {throw e})
		log.info(new Date().toISOString() + ' proj1.setup.3')
	})

	teardown('proj1 - teardown', () => {
		log.info(isoDate() + ' proj1 - teardown-1')
		deleteTestFiles()
		log.info(isoDate() + ' proj1 - teardown-2')
		// return unsetAblunitConfig('files.exclude')
		// await unsetAblunitConfig('files.exclude')
		unsetAblunitConfig('files.exclude').then(() => { log.info('unsetAblunitConfig complete') }, (e) => {throw e})
		log.info(isoDate() + ' proj1 - teardown-3')
	})

	test('proj1.0 output files exist one', () => {
		log.info(isoDate() + ' proj1.0-1 workspaceFolder=' + workspace.workspaceFolders?.[0].uri.fsPath)

		if (!workspace.workspaceFolders) {
			// throw new Error('proj1.0 - workspaceFolder not set')
			log.error('proj1.0 - workspaceFolder not set')
			assert.fail('proj1.0 - workspaceFolder not set')
		}

		// log.info('132')
		// if (!workspace.workspaceFolders[0].uri.fsPath.replace(/\\/g, '/').endsWith('test_projects/proj1')) {
		// 	log.info('133')
		// 	// throw new Error('proj1.0 - workspaceFolder not set to proj1 (' + workspace.workspaceFolders[0].uri.fsPath + ')')
		// 	log.error('proj1.0 - workspaceFolder not set to proj1 (' + workspace.workspaceFolders[0].uri.fsPath + ')')
		// 	log.info('134')
		// 	process.exit(1)
		// }
		// log.info('135')
		// log.info('proj1.0-2 workspaceFolder=' + workspace.workspaceFolders[0].uri.fsPath)
		log.info(isoDate() + ' 136')
		assert.assert(true)
		log.info(isoDate() + ' 137')
		const prom = newTruePromise()
		log.info(isoDate() + ' 138')
		return prom.then(() => { log.info('139') })
	})

	test('proj1.1 output files exist two', async () => {
		log.info('proj1.1 - output files exist - 1')
		assert.assert(true)
		const workspaceUri = getWorkspaceUri()
		const ablunitJson = Uri.joinPath(workspaceUri, 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceUri, 'results.xml')
		const resultsJson = Uri.joinPath(workspaceUri, 'results.json')
		assert.notFileExists(ablunitJson)
		assert.notFileExists(resultsXml)

		log.info('proj1.1.1')
		await runAllTests()
		log.info('proj1.1.2')

		assert.fileExists(ablunitJson)
		log.info('proj1.1.3')
		if (process.platform === 'win32' || process.env['WSL_DISTRO_NAME'] !== undefined) {
			assert.fileExists(resultsXml)
		} else {
			assert.notFileExists(resultsXml)
		}
		assert.notFileExists(resultsJson)
	})

	test('proj1.2 - output files exist 2 - exclude compileError.p', async () => {
		await workspace.getConfiguration('ablunit').update('files.exclude', [ '.builder/**', 'compileError.p' ]).then(() => {
			return runAllTests()
		})
		// await updateConfig('ablunit.files.exclude', [ '.builder/**', 'compileError.p' ])
		// await runAllTests()

		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
		const testCount = await getTestCount(resultsJson)
		assert.equal(testCount, 12)
	})

	test('proj1.3 - output files exist 3 - exclude compileError.p as string', async () => {
		// this isn't officially supported and won't syntac check in the settings.json file(s), but it works
		await updateConfig('ablunit.files.exclude', 'compileError.p')
		await runAllTests()

		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
		const testCount = await getTestCount(resultsJson)
		assert.equal(testCount, 12)
	})

	test('proj1.4 - run test case in file', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(getWorkspaceUri(), 'procedureTest.p'))
		await commands.executeCommand('testing.runCurrentFile')

		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
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
		await commands.executeCommand('vscode.open', Uri.joinPath(getWorkspaceUri(), 'procedureTest.p'))
		if(window.activeTextEditor) {
			window.activeTextEditor.selection = new Selection(21, 0, 21, 0)
		} else {
			assert.fail('vscode.window.activeTextEditor is undefined')
		}
		await commands.executeCommand('testing.runAtCursor')

		const resultsJson = Uri.joinPath(getWorkspaceUri(), 'results.json')
		const testCount = await getTestCount(resultsJson)
		const pass = await getTestCount(resultsJson, 'pass')
		const fail = await getTestCount(resultsJson, 'fail')
		const error = await getTestCount(resultsJson, 'error')
		assert.equal(1, testCount)
		assert.equal(1, pass)
		assert.equal(0, fail)
		assert.equal(0, error)
	})
})
