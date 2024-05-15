import { assert, extensions, log, runAllTests, sleep, suiteSetupCommon } from '../testCommon'

function testComplete (done: Mocha.Done) {
	done()
	return true
}

suite('projAtStart  - Extension Test Suite', () => {

	// test('projAtStart - ${workspaceFolder}/ablunit.json file exists', (done) => {
	test('projAtStart - ${workspaceFolder}/ablunit.json file exists', () => {
		return runAllTests()
			.then(() => {
				log.info('runAllTests().then() complete!')
				assert.fileExists('results.xml')
				log.info('assertComplete')
				return true
			}, (e: unknown) => { throw e })
			// .finally(() => {
			// 	log.info('finally()')
			// 	// log.info('calling done()')
			// 	// done()
			// 	// log.info('called done()')
			// })
	})

	test('projAtStart - enable proposed api', () => {
		const ext = extensions.getExtension('kherring.ablunit-test-runner')
		if (!ext) {
			assert.fail('proposed API extension not found')
			return
		}

		// log.info('ablunit-test-runner=' + JSON.stringify(ext))
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		log.info('proposed? ' + ext.packageJSON.displayName)
		// log.info('process.argv=' + JSON.stringify(process.argv, null, 2))
		// log.info('window.state=' + JSON.stringify(vscode.window.state))
		// log.info('ext.exports=' + JSON.stringify(ext.exports))
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		const proposedApiEnabled = ext.packageJSON.displayName.includes('insiders')

		// log.info(vscode.extensions.checkProposedApiEnabled)

		assert.equal(proposedApiEnabled, process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] === 'insiders', 'proposed API enabled')
	})

})
