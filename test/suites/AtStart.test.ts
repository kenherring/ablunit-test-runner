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


	/*
	 * Validate the correct code is running for the correct version of vscode
	 *
	 * Disabled for now since we don't need it.
	 */
	// test('projAtStart - enable proposed api', () => {
	// 	const ext = extensions.getExtension('kherring.ablunit-test-runner')
	// 	if (!ext) {
	// 		assert.fail('proposed API extension not found')
	// 		return
	// 	}

	// 	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
	// 	const proposedApiEnabled = ext.packageJSON['displayName'].includes('insiders')
	// 	assert.equal(proposedApiEnabled, process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] === 'insiders', 'proposed API enabled')
	// })

})
