import { assert, extensions, log, runAllTests, suiteSetupCommon } from '../testCommon'

suite('projAtStart  - Extension Test Suite', () => {

	suiteSetup('proj0 - suiteSetup', async () => {
		log.info('suiteSetup starting...')
		await suiteSetupCommon().then()
		log.info('suiteSetup complete!')
	})

	test('projAtStart - ${workspaceFolder}/ablunit.json file exists', async () => {
		await runAllTests(true, false)
		assert.fileExists('results.xml')
	})

	test('projAtStart - enable proposed api', () => {
		const ext = extensions.getExtension('kherring.ablunit-test-runner')
		if (!ext) {
			assert.fail('proposed API extension not found')
			return
		}

		log.info('ablunit-test-runner=' + JSON.stringify(ext))
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		log.info('proposed? ' + ext.packageJSON['displayName'])
		log.info('process.argv=' + JSON.stringify(process.argv, null, 2))
		// log.info('window.state=' + JSON.stringify(vscode.window.state))
		log.info('ext.exports=' + JSON.stringify(ext.exports))
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		const proposedApiEnabled = ext.packageJSON['displayName'].includes('insiders')

		// log.info(vscode.extensions.checkProposedApiEnabled)

		assert.equal(proposedApiEnabled, process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] === 'insiders', 'proposed API enabled')
	})

})
