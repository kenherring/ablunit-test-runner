
import { assert, log, sleep } from '../testCommon'

log.debug('STARTED simpleTest.test.js')

suite ('simpleTestSuite', () => {

	suiteTeardown(() => {
		log.info('suiteTeardown - simpleSuite complete')
	})

	test('Sample Test 1', async () => {
		await sleep(60).then()
		log.info('args=' + process.argv.join(' '))
		assert.equal(-1, [1, 2, 3].indexOf(5))
		assert.equal(-1, [1, 2, 3].indexOf(0))
		// assert.equal(-1, [1, 2, 3].indexOf(1))
	})

	test('Sample Test 2', async () => {
		assert.equal(-1, [1, 2, 3].indexOf(5))
		assert.equal(-1, [1, 2, 3].indexOf(0))
		// assert.equal(-1, [1, 2, 3].indexOf(1))
		await sleep(60).then()
	})
})
