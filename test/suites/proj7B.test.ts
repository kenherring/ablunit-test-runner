import { CancellationError, commands } from 'vscode'
import { assert, beforeCommon, beforeProj7, getTestControllerItemCount, log, refreshTests, runAllTests, RunStatus, sleep, waitForTestRunStatus } from '../testCommon'
import { Duration } from '../../src/ABLUnitCommon'

suite('proj7B - Extension Test Suite', () => {

	suiteSetup('proj7B - before', async () => {
		await beforeProj7()
	})

	setup('proj7B - beforeEach', beforeCommon)

	test('proj7B.1 - cancel test refresh', async () => {
		const minCancelTime = 1
		const maxCancelTime = 350
		const maxRefreshTime = 700

		log.info('refreshing tests')
		const startRefreshTime = new Duration()
		const refresh = refreshTests()
		let testCount = 0
		setTimeout(() => { throw new Error('timeout waiting for getTestControllerItemCount to return > 2 (got ' + testCount + ')') }, 5000)
		while(testCount < 2) {
			testCount = await getTestControllerItemCount('ABLTestFile')
			if (testCount >= 2) { break }
			await sleep2(2)
			// await sleep(5, 'waiting for getTestControllerItemCount to return > 10 (got ' + testCount + ')')
			if (startRefreshTime.elapsed() > 10000) {
				throw new Error('timeout waiting for getTestControllerItemCount to return > 2 (got ' + testCount + ')')
			}
		}

		log.info('cancelling test refresh')
		const startCancelTime = new Duration()
		try {
			await commands.executeCommand('testing.cancelTestRefresh').then(() => {
				log.info('testing.cancelTestRefresh completed')
				return
			}, (err) => {
				log.error('testing.cancelTestRefresh caught an exception. err=' + err)
				throw err
			})
			log.info(' - elapsedCancelTime=' + startCancelTime.elapsed() + 'ms, elapsedRefreshTime=' +  startRefreshTime.elapsed() + 'ms')
			assert.durationMoreThan(startCancelTime, minCancelTime)
			assert.durationLessThan(startCancelTime, maxCancelTime)
			assert.durationLessThan(startRefreshTime, maxRefreshTime)
		} catch (err) {
			assert.fail('unexpected error: ' + err)
		}

		const ablfileCount = await getTestControllerItemCount('ABLTestFile')
		log.info('controller file count after refresh = ' + ablfileCount)
		assert.assert(ablfileCount > 1 && ablfileCount < 1000, 'ablfileCount should be > 1 and < 500, but is ' + ablfileCount)

		await refresh.then(() => {
			assert.fail('testing.refreshTests completed without throwing CancellationError')
			return
		}, (err) => {
			if (err instanceof CancellationError) {
				log.info('testing.refreshTests threw CancellationError as expected')
			} else {
				const e = err as Error
				assert.equal(e.name, 'Canceled', 'testing.refreshTests threw unexpected error. Expected e.name="Canceled" err=' + err)
			}
		})
	})

	test('proj7B.2 - cancel test run while adding tests', async () => {
		// const maxCancelTime = 1000
		// const runTestTime = new Duration()

		runAllTests().catch((err: unknown) => { log.info('runAllTests got error: ' + err) })
		await sleep(250)
			.then(() => { return waitForTestRunStatus(RunStatus.Constructed) })
	})
	// 	runAllTests().then(() => {
	// 		log.info('runProm done ' + runTestTime)
	// 	}, (err) => {
	// 		throw err
	// 	})
	// 	await waitForTestRunStatus(RunStatus.Constructed)

	// const resArr = await getCurrentRunData()
	// const res = resArr[0]

	// 	const resArr = await getCurrentRunData()
	// 	const res = resArr[0]

	// 	// TODO - fix for 12.7.0

	// 	// if (res.status == RunStatus.Cancelled) {
	// 	// 	log.info('runAllTests completed with status=\'run cancelled\'')
	// 	// } else {
	// 	// 	assert.fail('runAllTests completed without status=\'run cancelled\' (status=\'' + res.status + '\')')
	// 	// }

	test('proj7B.3 - cancel test run while _progres is running', () => {
		// const maxCancelTime = 1000
		// const runTestTime = new Duration()
	})

	// TODO - reenable this test
	// test('proj7B.3 - cancel test run while _progres is running', async () => {
	// 	const maxCancelTime = 1000
	// 	const runTestTime = new Duration()
	// 	const runProm = runAllTests().then(() => {
	// 		log.info('runProm done ' + runTestTime)
	// 	}, (e) => {
	// 		log.error('runProm error e=' + e)
	// 		throw e
	// 	})
	// 	await sleep()

	// 	// wait up to 60 seconds until ABLUnit is actually running, then cancel
	// 	// this validates the cancel will abort the spawned _progres process
	// 	await waitForTestRunStatus(RunStatus.Executing).then(async () => {
	// 		await sleep2(500)
	// 		return
	// 	}, (e) => {
	// 		log.error('Error! e=' + e)
	// 		throw e
	// 	})
	// 	const prom1 = sleep2(500)
	// 	const prom2 = sleep2(500)
	// 	await prom1
	// 	await prom2

	// 	const resArr = await getCurrentRunData(1, 2)
	// 	if (!resArr[0]) {
	// 		assert.fail('getCurrentRunData returned undefined')
	// 	}
	// 	if (resArr[0].status < RunStatus.Executing) {
	// 		assert.fail('test run did not reach status \'running command\'')
	// 	}
	// 	await sleep2(2000)

	// 	const saveLogLevel = log.getLogLevel()
	// 	log.setLogLevel(LogLevel.Debug)
	// 	const elapsedCancelTime = await cancelTestRun(false).then((r) => {
	// 		log.info('cancelTestRun completed (' + r + ')')
	// 		return r
	// 	})
	// 	log.setLogLevel(saveLogLevel)
	// 	log.info(isoDate() + ' testRunCancelled ' + elapsedCancelTime)
	// 	assert.durationLessThan(elapsedCancelTime, maxCancelTime)
	// 	assert.assert(true, 'testing.cancelRun completed successfully')

	// 	// TODO - fix for 12.7.0

	// 	// log.info('waiting for runProm to complete')
	// 	// await runProm.then(() => {
	// 	// 	log.info('runProm completed')
	// 	// }, (e) => {
	// 	// 	log.error('runProm error e=' + e)
	// 	// 	throw e
	// 	// })

	// 	// 	const recentResults = await getResults(0)
	// 	// 	log.info('recentResults.length=' + recentResults.length)
	// 	// 	// assert.equal(0, recentResults.length, 'expected recentResults.length=0, but got ' + recentResults.length)
	// })

})
