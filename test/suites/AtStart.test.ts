import { assert, log, runAllTests, suiteSetupCommon, extensions } from '../testCommon'

suite('projAtStart  - Extension Test Suite - bdd', () => {

	suiteSetup('pronAtStart - before', async () => {
		await suiteSetupCommon()
		log.info('suiteSetupCommon complete')
		return
	})

	test('projAtStart - ${workspaceFolder}/ablunit.json file exists - return promise', () => {
		log.info('start test 1')
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
	test.skip('projAtStart - enable proposed api', () => {
		const ext = extensions.getExtension('kherring.ablunit-test-runner')
		if (!ext) {
			assert.fail('proposed API extension not found')
			return
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/dot-notation
		const proposedApiEnabled = ext.packageJSON['displayName'].includes('insiders')
		assert.equal(proposedApiEnabled, process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] === 'insiders', 'proposed API enabled')
	})

})
