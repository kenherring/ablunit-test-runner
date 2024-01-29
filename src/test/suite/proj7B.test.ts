import { strict as assert } from 'assert'
import { before } from 'mocha'
import { CancellationError, TestItemCollection, commands } from 'vscode'
import { getTestController, runAllTests, sleep, waitForExtensionActive } from '../testCommon'
import { log } from '../../ChannelLogger'

const projName = 'proj7B'

before(async () => {
	await waitForExtensionActive()
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - cancel test refresh', async () => {
		const maxCancelTime = 250
		const maxRefreshTime = 2500

		log.info('refreshing tests')
		const startRefreshTime = Date.now()
		const refresh = commands.executeCommand('testing.refreshTests')

		let testCount = getTestControllerItemCount('ABLTestFile')
		log.info("testCount-1=" + testCount)
		while(testCount < 10) {
			await sleep(250)
			testCount = getTestControllerItemCount('ABLTestFile')
		}
		log.info("testCount-2=" + testCount)

		log.info("cancelling test refresh")
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
			log.info(' - elapsedCancelTime=' + elapsedCancelTime + ", elapsedRefreshTime=" +  elapsedRefreshTime)
			assert(elapsedCancelTime < maxCancelTime, 'elapsedCancelTime should be < ' + maxCancelTime + 'ms, but is ' + elapsedCancelTime)
			assert(elapsedRefreshTime < maxRefreshTime, 'elapsedRefreshTime should be < ' + maxRefreshTime + 'ms, but is ' + elapsedRefreshTime)
			await sleep(100)
		} catch (err) {
			assert.fail('unexpected error: ' + err)
		}

		const ablfileCount = getTestControllerItemCount('ABLTestFile')
		log.info("controller file count after refresh = " + ablfileCount)
		assert(ablfileCount > 1 && ablfileCount < 1000, "ablfileCount should be > 1 and < 500, but is " + ablfileCount)

		log.info('testing refreshTests throws an error after cancelTestRefresh')
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
		log.info('testing.cancelTestRefresh completed successfully')
	})


	test(projName + '.2 - cancel test run', async () => {
		runAllTests().then(() => { return }, (err) => { throw err })

		console.log("pausing 5 seconds")
		await new Promise((resolve) => { setTimeout(resolve, 5000) })
		const startCancelTime = Date.now()
		console.log("cancelling test run")
		await commands.executeCommand('testing.cancelRun').then(() => {
			const elapsedCancelTime = Date.now() - startCancelTime
			console.log("elapsedCancelTime=" + elapsedCancelTime)
			assert(elapsedCancelTime < 1000, "cancelTime should be < 1 second, but is " + elapsedCancelTime)
		})
		assert(true, "testing.cancelRun completed successfully")
	})

})

function getTestControllerItemCount (type?: 'ABLTestFile' | undefined) {
	const ctrl = getTestController()
	return ctrl.items.size + getChildTestCount(type, ctrl.items)
}

function getChildTestCount (type: string | undefined, items: TestItemCollection) {
	if (items.size === 0) { return 0 }
	let count = 0

	for (const [id, item] of items) {
		if (id.endsWith('.p') || id.endsWith('.cls')) {
			count ++
		} else {
			count += getChildTestCount(type, item.children)
		}
	}
	return count
}
