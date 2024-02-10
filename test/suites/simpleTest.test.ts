
import * as assert from 'assert'
import * as vscode from 'vscode'
console.log("STARTED simpleTest.test.js")

export const simpleTestSuite = suite('Sample Test Suite', () => {
	suiteTeardown(() => {
		vscode.window.showInformationMessage('All tests done!')
	});

	test('Sample test 1', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5))
		assert.strictEqual(-1, [1, 2, 3].indexOf(0))
		// assert.strictEqual(-1, [1, 2, 3].indexOf(1))
	})
})

module.exports = simpleTestSuite
