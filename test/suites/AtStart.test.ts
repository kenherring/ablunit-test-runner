import { assert, extensions, log, runAllTests, suiteSetupCommon } from '../testCommon'

suite('projAtStart  - Extension Test Suite - bdd', () => {

	suiteSetup('projAtStart - before', () => {
		return suiteSetupCommon()
	})

	// test('projAtStart - ${workspaceFolder}/ablunit.json file exists', (done) => {
	test('projAtStart - ${workspaceFolder}/ablunit.json file exists - return promise', () => {
		return runAllTests()
			.then(() => {
				log.info('runAllTests().then() complete!')
				assert.fileExists('results.xml')
				log.info('assertComplete')
				return true
			}, (e: unknown) => { throw e })
	})

	test('projAtStart - ${workspaceFolder}/ablunit.json file exists - async await', async () => {
		await runAllTests()
		log.info('runAllTests().then() complete!')
		assert.fileExists('results.xml')
		log.info('assertComplete')
	})

	test('projAtStart - enable proposed api', () => {
		const ext = extensions.getExtension('kherring.ablunit-test-runner')
		if (!ext) {
			assert.fail('proposed API extension not found')
			return
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		log.info('proposed? ' + ext.packageJSON.displayName)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		const proposedApiEnabled = ext.packageJSON.displayName.includes('insiders')
		assert.equal(proposedApiEnabled, process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] === 'insiders', 'proposed API enabled')
	})

})

// suite('projAtStart  - Extension Test Suite - tdd', () => {

// 	before('projAtStart - before', () => {
// 		return suiteSetupCommon()
// 	})

// 	// test('projAtStart - ${workspaceFolder}/ablunit.json file exists', (done) => {
// 	test('projAtStart - ${workspaceFolder}/ablunit.json file exists', () => {
// 		return runAllTests()
// 			.then(() => {
// 				log.info('runAllTests().then() complete!')
// 				assert.fileExists('results.xml')
// 				log.info('assertComplete')
// 				return true
// 			}, (e: unknown) => { throw e })
// 	})

// 	test('projAtStart - enable proposed api', () => {
// 		const ext = extensions.getExtension('kherring.ablunit-test-runner')
// 		if (!ext) {
// 			assert.fail('proposed API extension not found')
// 			return
// 		}

// 		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
// 		log.info('proposed? ' + ext.packageJSON.displayName)
// 		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
// 		const proposedApiEnabled = ext.packageJSON.displayName.includes('insiders')
// 		assert.equal(proposedApiEnabled, process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] === 'insiders', 'proposed API enabled')
// 	})

// })
