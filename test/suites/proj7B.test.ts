import { strict as assert } from 'assert'
import { CancellationError, commands } from 'vscode'
import { Duration, beforeProj7, cancelTestRun, getCurrentRunData, getResults, getTestControllerItemCount, log, refreshData, refreshTests, runAllTests, setupCommon, sleep, waitForTestRunStatus } from '../testCommon'

export default suite('proj7BSuite', () => {

	suiteSetup('proj7B - suiteSetup', async () => {
		setupCommon()
		await beforeProj7()
	})

	test('proj7B.1 - cancel test refresh', async () => {
		const maxCancelTime = 250
		const maxRefreshTime = 5000 // todo

		log.debug('refreshing tests')
		const startRefreshTime = Date.now()
		const refresh = refreshTests()
		let testCount = await getTestControllerItemCount('ABLTestFile')
		setTimeout(() => { throw new Error('timeout waiting for getTestControllerItemCount to return > 10 (got ' + testCount + ')') }, 5000)
		while(testCount < 10) {
			await sleep(250, 'waiting for getTestControllerItemCount to return > 10 (got ' + testCount + ')')
			testCount = await getTestControllerItemCount('ABLTestFile')
		}

		log.debug('cancelling test refresh')
		const startCancelTime = Date.now()
		try {
			await commands.executeCommand('testing.cancelTestRefresh').then(() => {
				log.debug('testing.cancelTestRefresh completed')
			}, (err) => {
				log.error('testing.cancelTestRefresh caught an exception. err=' + err)
				throw err
			})
			const elapsedCancelTime = Date.now() - startCancelTime
			const elapsedRefreshTime = Date.now() - startRefreshTime
			log.debug(' - elapsedCancelTime=' + elapsedCancelTime + ', elapsedRefreshTime=' +  elapsedRefreshTime)
			assert(elapsedCancelTime < maxCancelTime, 'elapsedCancelTime should be < ' + maxCancelTime + 'ms, but is ' + elapsedCancelTime)
			assert(elapsedRefreshTime < maxRefreshTime, 'elapsedRefreshTime should be < ' + maxRefreshTime + 'ms, but is ' + elapsedRefreshTime)
		} catch (err) {
			assert.fail('unexpected error: ' + err)
		}

		const ablfileCount = await getTestControllerItemCount('ABLTestFile')
		log.debug('controller file count after refresh = ' + ablfileCount)
		assert(ablfileCount > 1 && ablfileCount < 1000, 'ablfileCount should be > 1 and < 500, but is ' + ablfileCount)

		await refresh.then(() => {
			assert.fail('testing.refreshTests completed without throwing CancellationError')
		}, (err) => {
			if (err instanceof CancellationError) {
				log.debug('testing.refreshTests threw CancellationError as expected')
			} else {
				const e = err as Error
				assert(e.name === 'Canceled', 'testing.refreshTests threw unexpected error. Expected e.name="Canceled" err=' + err)
			}
		})
	})

	test('proj7B.2 - cancel test run while adding tests', async () => {
		const maxCancelTime = 1000
		const runTestTime = new Duration()

		runAllTests().then((ret) => {
			log.debug('runProm done ret=' + ret)
		}, (err) => {
			throw err
		})
		await waitForTestRunStatus('constructed')

		const elapsedCancelTime = await cancelTestRun(false)
		assert(elapsedCancelTime < maxCancelTime, 'cancelTime should be < ' + maxCancelTime + 'ms, but is ' + elapsedCancelTime + 'ms')

		const resArr = await getCurrentRunData()
		const res = resArr[0]


		await refreshTests().then(() => {
			if (res.status.startsWith('run cancelled')) {
				log.debug('runAllTests completed with status=\'run cancelled\'')
			} else {
				assert.fail('runAllTests completed without status=\'run cancelled\' (status=\'' + res.status + '\')')
			}
		}, (err) => {
			if (err instanceof CancellationError) {
				log.debug('runAllTests threw CancellationError as expected ' + runTestTime.toString())
			} else {
				const e = err as Error
				assert(e.name === 'Canceled', 'runAllTests threw unexpected error. Expected e.name="Canceled" err=' + err)
			}
		})
	})

	test('proj7B.3 - cancel test run while _progres is running', async () => {
		const maxCancelTime = 1000
		const runProm = runAllTests().then(() => { return }, (err) => { throw err })

		// wait up to 60 seconds until ABLUnit is actually running, then cancel
		// this validates the cancel will abort the spawned _progres process
		await waitForTestRunStatus('running command').then(async () => { await sleep(500) })
		await sleep(500)

		const resArr = await getCurrentRunData()
		const res = resArr[0]
		if (!res) {
			assert.fail('getCurrentRunData returned undefined')
		}
		if (res.status !== 'running command') {
			assert.fail('test run reach status \'running command\'')
		}

		const elapsedCancelTime = await cancelTestRun()
		assert(elapsedCancelTime < maxCancelTime, 'cancelTime should be < ' + maxCancelTime + 'ms, but is ' + elapsedCancelTime + 'ms')
		assert(true, 'testing.cancelRun completed successfully')

		log.debug('waiting for runProm to complete')
		await runProm.then(() => {
			log.debug('runProm completed')
		})

		await refreshData()
		const recentResults = await getResults(0)
		log.debug('recentResults.length=' + recentResults.length)
		assert.equal(0, recentResults.length, 'expected recentResults.length=0, but got ' + recentResults.length)
	})


})
