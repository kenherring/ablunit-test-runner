import { assert, beforeProj7, Duration, log, runAllTests, suiteSetupCommon } from '../testCommon'

suite('proj7A - Extension Test Suite', () => {

	suiteSetup('proj7A - before', () => {
		return suiteSetupCommon()
			.then(() => { return beforeProj7() })
	})



	test('proj7A.1 - test count', async () => {
		const duration = new Duration()
		log.info('300')
		await runAllTests()
		log.info('301')
		assert.tests.count(2000)
		log.info('302')
		assert.durationLessThan(duration, 60000)
		log.info('303')
	})

})
