/* eslint-disable no-console */
import * as assert from 'assert'
import * as vscode from 'vscode'

console.log('STARTED sampleExtensionTest.test.js')

export default suite('Extension Test Suite', () => {
	setup(() => {
		console.log('[setup] STARTED Extension Test Suite')
	})

	teardown(() => {
		vscode.window.showInformationMessage('All tests done!').then(() => {
			console.log('All tests done!')
		}, (err: unknown) => {
			console.error('All tests done! - error: ' + err)
		})
	})

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5))
		assert.strictEqual(-1, [1, 2, 3].indexOf(0))
	})
})
