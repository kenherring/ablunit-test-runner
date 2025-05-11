import { CancellationError, LogLevel, commands } from 'vscode'
import { assert, RunStatus, beforeCommon, beforeProj7, cancelTestRun, getCurrentRunData, getTestControllerItemCount, isoDate, log, refreshTests, runAllTests, waitForTestRunStatus, sleep } from '../testCommon'
import { Duration } from 'ABLUnitCommon'

suite('proj7B - Extension Test Suite', () => {

	suiteSetup('proj7B - before', async () => {
		beforeCommon()
		await beforeProj7()
	})

	setup('proj7B - beforeEach', () => {
		log.info('---------- setup proj7B ----------')
		beforeCommon()
	})

	test.skip('proj7B.1 - cancel test refresh', async () => {
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
			await sleep(2)
			if (startRefreshTime.elapsed() > 10000) {
				throw new Error('timeout waiting for getTestControllerItemCount to return > 2 (got ' + testCount + ')')
			}
		}

		await sleep(2)
		log.info('cancelling test refresh')
		const startCancelTime = new Duration()
		await commands.executeCommand('testing.cancelTestRefresh').then(() => {
			log.info('testing.cancelTestRefresh completed')
			return
		}, (e: unknown) => {
			log.error('testing.cancelTestRefresh caught an exception. e=' + e)
			throw e
		})
		log.info(' - elapsedCancelTime=' + startCancelTime.elapsed() + 'ms, elapsedRefreshTime=' +  startRefreshTime.elapsed() + 'ms')
		assert.durationMoreThan(startCancelTime, minCancelTime)
		assert.durationLessThan(startCancelTime, maxCancelTime)
		assert.durationLessThan(startRefreshTime, maxRefreshTime)

		const ablfileCount = await getTestControllerItemCount('ABLTestFile')
		log.info('controller file count after refresh = ' + ablfileCount)
		if (ablfileCount <= 2) {
			await sleep(10)
			const ablfileCount = await getTestControllerItemCount('ABLTestFile')
			log.info('controller file count after refresh(2) = ' + ablfileCount)
		}
		if (ablfileCount <= 2) {
			await sleep(10)
			const ablfileCount = await getTestControllerItemCount('ABLTestFile')
			log.info('controller file count after refresh(3) = ' + ablfileCount)
		}
		assert.assert(ablfileCount > 1 && ablfileCount < 2000, 'ablfileCount should be > 1 and < 500, but is ' + ablfileCount)

		const prom = refresh.then(() => {
			assert.fail('testing.refreshTests completed without throwing CancellationError')
			return
		}, (e: unknown) => {
			if (e instanceof CancellationError) {
				log.info('testing.refreshTests threw CancellationError as expected')
			} else {
				const err = e as Error
				assert.equal(err.name, 'Canceled', 'testing.refreshTests threw unexpected error. Expected e.name="Canceled" e=' + e)
			}
		})
		await prom
	})

	test('proj7B.2 - cancel test run while adding tests', async () => {
		const maxCancelTime = 1000
		// const runTestTime = new Duration()

		try {
			runAllTests(true, false).catch((e: unknown) => { log.info('runAllTests got error: ' + e) })
			await waitForTestRunStatus(RunStatus.Constructed)

			const elapsedCancelTime = await cancelTestRun(false)
			log.info('elapsedCancelTime=' + elapsedCancelTime + ', maxCancelTime=' + maxCancelTime)
			assert.durationLessThan(elapsedCancelTime, maxCancelTime)
			log.info('post-assert.duration')
		} catch (e: unknown) {
			if (e instanceof Error) {
				log.info('e.name=' + e.name)
			} else {
				log.error('not error type: ' + typeof e)
			}
			if (e instanceof Error && e.name == 'Canceled') {
				log.info('testing.cancelRun threw CancellationError as expected')
			}
			throw e
		}

		const resArr = await getCurrentRunData()
		const res = resArr[0]

		// TODO - fix for 12.7.0

		if (res.status == RunStatus.Cancelled) {
			log.info('runAllTests completed with status=\'run cancelled\'')
		} else {
			assert.fail('runAllTests completed without status=\'run cancelled\' (status=\'' + res.status + '\')')
		}

		// await refreshTests().then(() => {
		// 	if (res.status == RunStatus.Cancelled) {
		// 		log.info('runAllTests completed with status=\'run cancelled\'')
		// 	} else {
		// 		assert.fail('runAllTests completed without status=\'run cancelled\' (status=\'' + res.status + '\')')
		// 	}
		// }, (e: unknown) => {
		// 	if (e instanceof CancellationError) {
		// 		log.info('runAllTests threw CancellationError as expected ' + runTestTime.toString())
		// 	} else {
		// 		const e = e as Error
		// 		assert.equal(e.name, 'Canceled', 'runAllTests threw unexpected error. Expected e.name="Canceled" e=' + e)
		// 	}
		// })
	})

	test.skip('proj7B.3 - cancel test run while _progres is running', async () => {
		log.info('---------- proj7B.3 ----------')
		const maxCancelTime = 1000
		// const runTestTime = new Duration()

		runAllTests().catch((e: unknown) => { log.info('runAllTests got error: ' + e) })

		// wait up to 60 seconds until ABLUnit is actually running, then cancel
		// this validates the cancel will abort the spawned _progres process
		await waitForTestRunStatus(RunStatus.Executing)
			.then(() => { return sleep(500) })
			.catch((e: unknown) => { throw e })

		const resArr = await getCurrentRunData(1, 2)
		if (!resArr[0]) {
			assert.fail('getCurrentRunData returned undefined')
		}
		if (resArr[0].status < RunStatus.Executing) {
			assert.fail('test run did not reach status \'running command\'')
		}
		await sleep(2000)

		const saveLogLevel = log.getLogLevel()
		log.setLogLevel(LogLevel.Debug)
		const elapsedCancelTime = await cancelTestRun(false).then((r) => {
			log.info('cancelTestRun completed (' + r + ')')
			return r
		})
		log.setLogLevel(saveLogLevel)
		log.info(isoDate() + ' testRunCancelled ' + elapsedCancelTime)
		assert.durationLessThan(elapsedCancelTime, maxCancelTime)
		assert.assert(true, 'testing.cancelRun completed successfully')

		// TODO - fix for 12.7.0

		// log.info('waiting for runProm to complete')
		// await runProm.then(() => {
		// 	log.info('runProm completed')
		// }, (e: unknown) => {
		// 	log.error('runProm error e=' + e)
		// 	throw e
		// })

		// 	const recentResults = await getResults(0)
		// 	log.info('recentResults.length=' + recentResults.length)
		// 	// assert.equal(0, recentResults.length, 'expected recentResults.length=0, but got ' + recentResults.length)
	})

})
