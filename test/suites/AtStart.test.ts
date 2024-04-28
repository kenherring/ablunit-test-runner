import { doesFileExist } from 'src/ABLUnitCommon'
import { assert, extensions, log, runAllTests, suiteSetupCommon, toUri } from '../testCommon'

suite('projAtStart  - Extension Test Suite', () => {

	suiteSetup('proj0 - suiteSetup', async () => {
		log.info('suiteSetup starting...')
		await suiteSetupCommon()
		log.info('suiteSetup complete!')
	})

	test('projAtStart - ${workspaceFolder}/ablunit.json file exists', async () => {
		await runAllTests(true)
		// .then(() => {
		// 	// TODO! fix me on windows
		// 	// if (process.platform === 'win32' || process.env['WSL_DISTRO_NAME'] !== undefined) {
		// 	// 	assert.fileExists('results.xml')
		// 	// } else {
		// 	// 	assert.notFileExists('results.xml')
		// 	// }
		// })
		log.info('results.xml uri=' + toUri('results.xml'))
		log.info('results.xml file exists: ' + doesFileExist(toUri('results.xml')))
	})

	/**
	 * Check to confirm stable and insiders builds are testing with the correct code.
	 * Not needed at the moment, re-enable if we need to use the proposed API.
     */
	// test('projAtStart - enable proposed api', () => {
	// 	const ext = extensions.getExtension('kherring.ablunit-test-runner')
	// 	if (!ext) {
	// 		assert.fail('proposed API extension not found')
	// 		return
	// 	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
	// const proposedApiEnabled = ext.packageJSON['displayName'].includes('insiders')
	// 	assert.equal(proposedApiEnabled, process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] === 'insiders', 'proposed API enabled')
	// })

})
