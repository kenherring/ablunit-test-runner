import { Uri } from 'vscode'
import { assert, beforeProj7, Duration, getTestCount, getWorkspaceUri, runAllTests } from '../testCommon'

const workspaceUri = getWorkspaceUri()

suite('proj7A - Extension Test Suite', () => {

	suiteSetup('proj7A - before', async () => {
		await beforeProj7()
	})

	test('proj7A.1 - test count', async () => {
		const duration = new Duration()
		await runAllTests().then(() => {
			assert.tests.count(100000)
			assert.durationLessThan(duration, 45000)
		})
	})

})
