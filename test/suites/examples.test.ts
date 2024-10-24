import { assert, log } from '../testCommon'

function getValueOne (throwError = false) {
	log.info('starting getValueOne...')
	return new Promise((resolve, reject) => {
		if (throwError) {
			reject(new Error('getValueOne error'))
		}
		resolve(1)
	})
}

function getValueTwo () {
	log.info('starting getValueTwo...')
	// @no-sonar
	return new Promise((resolve) => {
		resolve(getValueTwoB())
	})
}

async function getValueTwoB () {
	log.info('starting getValueTwoB...')
	await Promise.resolve()
	return 2
}

function getValueThree () {
	log.info('starting getValueThree...')
	return Promise.resolve(3)
}

suite('test examples', () => {

	suiteSetup ('examples.suiteSetup', () => {
		log.info('suiteSetup')
	})

	setup('examples.setup', () =>{
		log.info('before')
	})

	teardown('examples.teardown', () => {
		log.info('teardown')
	})

	suiteTeardown ('examples.suiteTeardown', () => {
		log.info('suiteTeardown')
	})

	// ---------- example 1 ----------

	test.skip('example1.1', () => {
		assert.equal(1, getValueOne())
		// AssertionError [ERR_ASSERTION]: 1 == Promise {  <pending> }
	})

	test('example1.2', async () => {
		assert.equal(1, await getValueOne())
	})

	test('example1.3', () => {
		return getValueOne().then((value) => {
			assert.equal(1, value)
			return
		}, (e) => {
			log.error('example1.3 error! e=' + e)
			assert.fail('unexpected error: ' + e)
		})
	})

	test('example1.4', (done) => {
		return getValueOne().then((value) => {
			assert.equal(1, value)
			done()
			return
		}, (e) => {
			log.error('example1.4 error! e=' + e)
			assert.fail('unexpected error: ' + e)
		})
	})

	test('example1.5', async () => {
		await getValueOne().then((value) => {
			assert.equal(1, value)
		})
	})

	test('example1.6', () => {
		return getValueOne().then((value) => {
			assert.equal(1, value)
			return
		})
	})

	test.skip('example1.7', (done) => {
		return getValueOne().then((value) => {
			assert.equal(1, value)
			done()
			return
		})
		// Error: Resolution method is overspecified. Specify a callback *or* return a Promise; not both.
	})

	test.skip('example1.8', (done) => {
		return getValueOne().then((value) => {
			assert.equal(1, value)
			done()
			return
		})
		// Error: Resolution method is overspecified. Specify a callback *or* return a Promise; not both.
	})

	// ---------- example 2 ----------

	test('example2.1', (done) => {
		return getValueTwo().then((value) => {
			assert.equal(2, value)
			done()
			return
		}, (e) => {
			log.error('example1.4 error! e=' + e)
			assert.fail('unexpected error: ' + e)
			return
		})
	})

	test.skip('example2.2', (done) => {
		return getValueTwoB().then((value) => {
			assert.equal(2, value)
			done()
			return
		}, (e) => {
			log.error('example1.4 error! e=' + e)
			assert.fail('unexpected error: ' + e)
		})
		// Error: Resolution method is overspecified. Specify a callback *or* return a Promise; not both.
	})

	test('example2.3', () => {
		return getValueTwo().then((value) => {
			assert.equal(2, value)
			return
		}, (e) => {
			log.error('example1.4 error! e=' + e)
			assert.fail('unexpected error: ' + e)
		})
	})

	test.skip('example2.4', (done) => {
		return getValueTwo().then((value) => {
			assert.equal(2, value)
			done()
			return
		}, (e) => {
			log.error('example1.4 error! e=' + e)
			assert.fail('unexpected error: ' + e)
		})
		// Error: Resolution method is overspecified. Specify a callback *or* return a Promise; not both.
	})

	test.skip('example2.5', () => {
		assert.equal(2, getValueTwo())
		// 2 == Promise { <pending> }
	})

	test('example2.6', async () => {
		assert.equal(2, await getValueTwo())
	})

	// ---------- Example 3 ----------

	test.skip('example3.1', () => {
		assert.equal(3, getValueThree())
		// AssertionError [ERR_ASSERTION]: 3 == Promise { <3> }
	})

	test('example3.2', async () => {
		assert.equal(3, await getValueThree())
	})

	test('example3.3', () => {
		return getValueThree().then((value) => {
			assert.equal(3, value)
			return
		}, (e) => {
			log.error('example1.3 error! e=' + e)
			assert.fail('unexpected error: ' + e)
			return
		})
	})

	test('example3.4', (done) => {
		return getValueThree().then((value) => {
			assert.equal(3, value)
			done()
			return
		}, (e) => {
			log.error('example1.4 error! e=' + e)
			assert.fail('unexpected error: ' + e)
		})
	})

	test('example3.5', async () => {
		await getValueThree().then((value) => {
			assert.equal(3, value)
		})
	})

	test('example3.6', () => {
		return getValueThree().then((value) => {
			assert.equal(3, value)
			return
		})
	})

	test.skip('example3.7', (done) => {
		return getValueThree().then((value) => {
			assert.equal(3, value)
			done()
			return
		})
		// Error: Timeout of 1000ms exceeded. For async tests and hooks, ensure "done()" is called; if returning a Promise, ensure it resolves. (D:\ablunit-test-runner\test\suites\examples.test.ts)
	})

	test.skip('example3.8', (done) => {
		return getValueThree().then((value) => {
			assert.equal(3, value)
			done()
			return
		})
		// Error: Timeout of 1000ms exceeded. For async tests and hooks, ensure "done()" is called; if returning a Promise, ensure it resolves. (D:\ablunit-test-runner\test\suites\examples.test.ts)
	})

})
