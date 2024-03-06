import { strict as assert } from 'assert'
import { before } from 'mocha'
import { CancellationError, LogLevel, commands } from 'vscode'
import { RunStatus, beforeCommon, beforeProj7, cancelTestRun, getCurrentRunData, getResults, getTestControllerItemCount, isoDate, log, refreshTests, runAllTests, sleep, waitForTestRunStatus } from '../testCommon'
import { Duration } from '../../ABLUnitCommon'

const projName = 'proj7B'

suite(projName + ' - Extension Test Suite', () => {

	before(projName + ' - before', async () => {
		beforeCommon()
		await beforeProj7()
	})

	test(projName + '.1 - cancel test refresh', async () => {
		// TODO
		// const maxCancelTime = 250
		const maxCancelTime = 2000
		// TODO
		// const maxRefreshTime = 250
		const maxRefreshTime = 7000

		log.info('refreshing tests')
		const startRefreshTime = Date.now()
		const refresh = refreshTests()
		let testCount = await getTestControllerItemCount('ABLTestFile')
		setTimeout(() => { throw new Error('timeout waiting for getTestControllerItemCount to return > 10 (got ' + testCount + ')') }, 5000)
		while(testCount < 10) {
			await sleep(250, 'waiting for getTestControllerItemCount to return > 10 (got ' + testCount + ')')
			testCount = await getTestControllerItemCount('ABLTestFile')
		}

		log.info('cancelling test refresh')
		const startCancelTime = Date.now()
		try {
			await commands.executeCommand('testing.cancelTestRefresh').then(() => {
				log.info('testing.cancelTestRefresh completed')
			}, (err) => {
				log.error('testing.cancelTestRefresh caught an exception. err=' + err)
				throw err
			})
			const elapsedCancelTime = Date.now() - startCancelTime
			const elapsedRefreshTime = Date.now() - startRefreshTime
			log.info(' - elapsedCancelTime=' + elapsedCancelTime + ', elapsedRefreshTime=' +  elapsedRefreshTime)
			assert(elapsedCancelTime < maxCancelTime, 'elapsedCancelTime should be < ' + maxCancelTime + 'ms, but is ' + elapsedCancelTime)
			assert(elapsedRefreshTime < maxRefreshTime, 'elapsedRefreshTime should be < ' + maxRefreshTime + 'ms, but is ' + elapsedRefreshTime)
		} catch (err) {
			assert.fail('unexpected error: ' + err)
		}

		const ablfileCount = await getTestControllerItemCount('ABLTestFile')
		log.info('controller file count after refresh = ' + ablfileCount)
		assert(ablfileCount > 1 && ablfileCount < 1000, 'ablfileCount should be > 1 and < 500, but is ' + ablfileCount)

		await refresh.then(() => {
			assert.fail('testing.refreshTests completed without throwing CancellationError')
		}, (err) => {
			if (err instanceof CancellationError) {
				log.info('testing.refreshTests threw CancellationError as expected')
			} else {
				const e = err as Error
				assert(e.name === 'Canceled', 'testing.refreshTests threw unexpected error. Expected e.name="Canceled" err=' + err)
			}
		})
	})

	test(projName + '.2 - cancel test run while adding tests', async () => {
		const maxCancelTime = 1000
		const runTestTime = new Duration()

		runAllTests().then(() => {
			log.info('runProm done ' + runTestTime)
		}, (err) => {
			throw err
		})
		await waitForTestRunStatus(RunStatus.Constructed)

		const elapsedCancelTime = await cancelTestRun(false)
		assert(elapsedCancelTime < maxCancelTime, 'cancelTime should be < ' + maxCancelTime + 'ms, but is ' + elapsedCancelTime + 'ms')

		const resArr = await getCurrentRunData()
		const res = resArr[0]


		await refreshTests().then(() => {
			if (res.status === RunStatus.Cancelled) {
				log.info('runAllTests completed with status=\'run cancelled\'')
			} else {
				assert.fail('runAllTests completed without status=\'run cancelled\' (status=\'' + res.status + '\')')
			}
		}, (err) => {
			if (err instanceof CancellationError) {
				log.info('runAllTests threw CancellationError as expected ' + runTestTime.toString())
			} else {
				const e = err as Error
				assert(e.name === 'Canceled', 'runAllTests threw unexpected error. Expected e.name="Canceled" err=' + err)
			}
		})
	})

	test(projName + '.3 - cancel test run while _progres is running', async () => {
		const maxCancelTime = 1000
		const runTestTime = new Duration()
		const runProm = runAllTests().then(() => {
			log.info('runProm done ' + runTestTime)
			return
		}, (e) => {
			log.error('runProm error e=' + e)
			throw e
		})

		// wait up to 60 seconds until ABLUnit is actually running, then cancel
		// this validates the cancel will abort the spawned _progres process
		await waitForTestRunStatus(RunStatus.Executing).then(async () => {
			return sleep(500)
		}, (e) => {
			log.error('Error! e=' + e)
			throw e
		})

		const resArr = await getCurrentRunData()
		if (!resArr[0]) {
			assert.fail('getCurrentRunData returned undefined')
		}
		if (resArr[0].status !== RunStatus.Executing) {
			assert.fail('test run did not reach status \'running command\'')
		}

		const saveLogLevel = log.getLogLevel()
		log.setLogLevel(LogLevel.Debug)
		const elapsedCancelTime = await cancelTestRun(false)
		log.setLogLevel(saveLogLevel)
		log.info(isoDate() + ' testRunCancelled ' + elapsedCancelTime)
		assert(elapsedCancelTime < maxCancelTime, 'cancelTime should be < ' + maxCancelTime + 'ms, but is ' + elapsedCancelTime + 'ms')
		assert(true, 'testing.cancelRun completed successfully')

		log.info('waiting for runProm to complete')
		await runProm.then(() => {
			log.info('runProm completed')
		}, (e) => {
			log.error('runProm error e=' + e)
			throw e
		})

		const recentResults = await getResults(0)
		log.info('recentResults.length=' + recentResults.length)
		log.info('recentResults.length=' + recentResults.length)
		assert.equal(0, recentResults.length, 'expected recentResults.length=0, but got ' + recentResults.length)
	})

})
