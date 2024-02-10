
import * as vscode from 'vscode'
import { strict as assert } from 'assert'
console.log("STARTED setup.test.ts")

export const setupSuite = suite('All Extension Test Suites', () => {

	suiteSetup('Suite Setup', async () => {
		console.log("installing openedge-abl-lsp extension...")
		const ext = vscode.extensions.getExtension('riverrsidesoftware.openedge-abl-lsp')
		console.log("ext = " + ext)

		if (!ext) {
			console.log("openedge-abl-lsp extension not installed!")
			return vscode.commands.executeCommand('workbench.extensions.installExtension', 'riversidesoftware.openedge-abl-lsp').then(() => {
				console.log("openedge-abl-lsp extension installed!")
			}, (err) => {
				if (err.toString() === 'Error: Missing gallery') {
					return
				}
				console.log("install error message: '" + err.getMessage() + '\'')
				throw err
			})

			// 	// console.log("install error: " + err.getMessage())
			// 	throw err
			// })`

		}
	})

	suiteTeardown(() => {
		vscode.window.showInformationMessage('All tests done!');
		console.log("suiteTeardown")
	})

	test('Sample test after setup', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5))
		assert.strictEqual(-1, [1, 2, 3].indexOf(0))
	})
})

module.exports = setupSuite
