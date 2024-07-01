import { RunStatus } from 'src/ABLUnitRun'
import { assert, CancellationError, commands, Duration, beforeProj7, cancelTestRun, getCurrentRunData, getResults, getTestControllerItemCount, log, refreshData, refreshTests, runAllTests, sleep, waitForTestRunStatus, runAllTestsDuration } from '../testCommon'

async function getTestCount (waitForTestCount = 1, maxWaitTime = 5000): Promise<number> {
	const timer = new Duration ('getTestCount')
	let testCount = 0
	while (testCount < waitForTestCount && timer.elapsed() < maxWaitTime) {
		testCount = await getTestControllerItemCount('ABLTestFile')
		if (testCount >= waitForTestCount) {
			break
		}
		await sleep(500, 'waiting to test count > ' + waitForTestCount + ' (got ' + testCount + ')')
	}
	return testCount
}

suite('proj7BSuite', () => {

	suiteSetup('proj7B - suiteSetup', () => beforeProj7())

	test('proj7B.1 - cancel test refresh', async () => {
		const maxCancelTime = 250
		const maxRefreshTime = 3000
		// const maxRefreshTime = 1000
		const waitForTestCount = 10

		log.debug('refreshing tests')
		log.info('refreshing tests')
		const refreshDuration = new Duration('refresh')
		const refresh = refreshTests()
		const testCount = await getTestCount(waitForTestCount, maxRefreshTime)
		log.debug('found ' + testCount + ' tests (refreshDuration=' + refreshDuration.elapsed() + 'ms')
		log.info('found ' + testCount + ' tests (refreshDuration=' + refreshDuration.elapsed() + 'ms')


		log.debug('cancelling test refresh')
		log.info('cancelling test refresh')
		const cancelDuration = new Duration('cancel')
		await commands.executeCommand('testing.cancelTestRefresh')
		log.debug(' - cancelDuration=' + cancelDuration.elapsed() + 'ms , refreshDuration=' +  refreshDuration.elapsed() + 'ms')
		log.info(' - cancelDuration=' + cancelDuration.elapsed() + 'ms , refreshDuration=' +  refreshDuration.elapsed() + 'ms')
		assert.durationLessThan(cancelDuration, maxCancelTime)
		assert.durationLessThan(refreshDuration, maxRefreshTime)

		const ablfileCount = await getTestControllerItemCount('ABLTestFile')
		log.debug('controller file count after refresh = ' + ablfileCount)
		log.info('controller file count after refresh = ' + ablfileCount)
		assert.assert(ablfileCount > 1 && ablfileCount < 1000, 'ablfileCount should be > 1 and < 500, but is ' + ablfileCount)

		await refresh.then(() => {
			assert.fail('testing.refreshTests completed without throwing CancellationError')
			return
		}, (err) => {
			if (err instanceof CancellationError) {
				log.debug('testing.refreshTests threw CancellationError as expected (refreshDuration=' + refreshDuration.elapsed() + 'ms)')
				log.info('testing.refreshTests threw CancellationError as expected')
			} else {
				const e = err as Error
				assert.assert(e.name === 'Canceled', 'testing.refreshTests threw unexpected error. Expected e.name="Canceled" err=' + err)
			}
		})
	})

	// TODO - reenable this test
	test.skip('proj7B.2 - cancel test run while adding tests', async () => {
		const maxCancelTime = 1000

		// const runTestsProm = runAllTests(true, false, 'proj7B.2').then((ret) => {
		// 	log.debug('runProm done ret=' + ret + ' ' + runAllTestsDuration)
		// }, (err) => {
		// 	throw err
		// })
		const runTestsProm = runAllTests(true, false, 'proj7B.2')
		await waitForTestRunStatus(RunStatus.Constructed)

		const cancelTestRunDuration = await cancelTestRun(false)
		runTestsProm.then(() => {
			assert.fail('runAllTests completed without cancelling')
		}, (err) => {
			log.info('runAllTests threw error as expected ' + err)
			assert.durationLessThan(cancelTestRunDuration, maxCancelTime)
		})
		await sleep(1000).then(() => { return })

		const resArr = await getCurrentRunData()
		assert.equal(resArr.length, 1, 'expected 1 result, but got ' + resArr.length)

		if (resArr[0].status !== RunStatus.Cancelled) {
			assert.fail('runAllTests completed without status=\'run cancelled\' ' +
				'(status=\'' + resArr[0].status + '\', ' +
				'cancelDuration=' + cancelTestRunDuration?.elapsed() + 'ms, ' +
				'runAllTestsDuration=' + runAllTestsDuration?.elapsed() + 'ms)')
		}
		log.debug('runAllTests completed with status=\'run cancelled\' ' + cancelTestRunDuration)

		// await refreshTests().then(() => {
		// 	if (!resArr[0].status.startsWith('run cancelled')) {
		// 		assert.fail('runAllTests completed without status=\'run cancelled\' ' +
		// 			'(status=\'' + resArr[0].status + '\', ' +
		// 			'cancelDuration=' + cancelDuration.elapsed() + 'ms, ' +
		// 			'runTestDuration=' + runTestDuration.elapsed() + 'ms)')
		// 	}
		// 	log.debug('runAllTests completed with status=\'run cancelled\' ' + cancelDuration)
		// }, (err) => {
		// 	if (err instanceof CancellationError) {
		// 		log.debug('runAllTests threw CancellationError as expected ' + runTestDuration.toString())
		// 	} else {
		// 		const e = err as Error
		// 		assert.assert(e.name === 'Canceled', 'runAllTests threw unexpected error. Expected e.name="Canceled" err=' + err)
		// 	}
		// })
	})

	// TODO - reenable this test
	test.skip('proj7B.3 - cancel test run while _progres is running', async () => {
		const maxCancelTime = 1000
		const runProm = runAllTests(true, false, 'proj7B.3')

		// wait up to 60 seconds until ABLUnit is actually running, then cancel
		// this validates the cancel will abort the spawned _progres process
		await waitForTestRunStatus(RunStatus.Executing)

		const resArr = await getCurrentRunData()
		const res = resArr[0]
		assert.assert(res, 'getCurrentRunData returned undefined')
		assert.greaterOrEqual(res.status, RunStatus.Executing, 'test run reach status \'running command\'')

		const cancelDuration = await cancelTestRun(false)
		assert.durationLessThan(cancelDuration, maxCancelTime)

		log.debug('waiting for runProm to complete')
		await runProm.then(() => {
			log.debug('runProm completed')
		})

		await refreshData()
		const recentResults = await getResults(0)
		log.debug('recentResults.length=' + recentResults.length)
		assert.equal(0, recentResults.length, 'expected recentResults.length=0, but got ' + recentResults.length)
		// assert.equal(recentResults[0].status, RunStatus.Cancelled, 'expected recentResults.status=Cancelled, but got ' + recentResults[0].status)
	})

})
