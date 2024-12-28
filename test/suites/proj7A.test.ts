import { assert, beforeProj7, Duration, log, runAllTests, suiteSetupCommon } from '../testCommon'

suite('proj7A - Extension Test Suite', () => {

	suiteSetup('proj7A - before', () => {
		return suiteSetupCommon()
			.then(() => { return beforeProj7() })
			.then(() => {
				log.info('suiteSetup complete')
				return true
			})
	})

	test('proj7A.1 - test count', async () => {
		const duration = new Duration()
		await runAllTests()
		assert.tests.count(2000)
		assert.durationLessThan(duration, 60000)
	})

})
