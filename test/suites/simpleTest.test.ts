
import { assert, log, sleep } from '../testCommon'

log.debug('STARTED simpleTest.test.js')

export function simpleTestSuite () {

	suiteTeardown(() => {
		log.info('suiteTeardown - simpleSuite complete')
	})

	test('Sample Test 1', async () => {
		await sleep(60).then()
		log.info('args=' + process.argv.join(' '))
		assert.strictEqual(-1, [1, 2, 3].indexOf(5))
		assert.strictEqual(-1, [1, 2, 3].indexOf(0))
		// assert.strictEqual(-1, [1, 2, 3].indexOf(1))
	})

	test('Sample Test 2', async () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5))
		assert.strictEqual(-1, [1, 2, 3].indexOf(0))
		// assert.strictEqual(-1, [1, 2, 3].indexOf(1))
		await sleep(60).then()
	})
}
