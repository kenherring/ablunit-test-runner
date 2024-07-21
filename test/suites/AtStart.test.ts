import { assert, extensions, log, runAllTests, suiteSetupCommon } from '../testCommon'

suite('projAtStart  - Extension Test Suite - bdd', () => {

	suiteSetup('projAtStart - before', async () => {
		log.info('suiteSetupCommon() start')
		await suiteSetupCommon().then(() => { return true }, (e: unknown) => { throw e })
		log.info('suiteSetupCommon() end')
		return true
	})

	// test('projAtStart - ${workspaceFolder}/ablunit.json file exists', (done) => {
	test('projAtStart - ${workspaceFolder}/ablunit.json file exists - return promise', () => {
		const prom = runAllTests()
			.then(() => {
				log.info('runAllTests().then() complete!')
				assert.fileExists('results.xml')
				log.info('assertComplete')
				return true
			}, (e: unknown) => { throw e })
		return prom
	})

	test('projAtStart - ${workspaceFolder}/ablunit.json file exists - async await', async () => {
		await runAllTests()
		log.info('runAllTests().then() complete!')
		assert.fileExists('results.xml')
		log.info('assertComplete')
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
