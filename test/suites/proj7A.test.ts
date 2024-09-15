import { assert, beforeProj7, Duration, runAllTests } from '../testCommon'

suite('proj7A - Extension Test Suite', () => {

	suiteSetup('proj7A - before', async () => {
		await beforeProj7()
	})

	test('proj7A.1 - test count', async () => {
		const duration = new Duration()
		await runAllTests().then(() => {
			assert.tests.count(2020)
			assert.durationLessThan(duration, 10000)
		})
	})

})
