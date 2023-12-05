// This file was adapted from the VSCode docs:
//    * https://code.visualstudio.com/api/working-with-extensions/testing-extension#the-test-runner-script
// Instead of testing as a development extension this loads a dummy extension,
// installs the packaged ablunit-test-provider extension, and runs a test.
// This gives confidence that the packaged extension is functional.

import * as cp from 'child_process'
import * as path from 'path'
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron'

async function main() {
	await runTest('stable')
	await runTest('insiders')
}

async function runTest(version: string) {
	console.log("[installAndRun] start test run.  version=" + version)
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../')
		const extensionTestsPath = path.resolve(__dirname, './index')
		const vscodeExecutablePath = await downloadAndUnzipVSCode(version)
		const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)

		const packagedExtensionPath = path.resolve(__dirname, '../../../ablunit-test-provider-0.1.7.vsix')
		const projDir = path.resolve(__dirname, '../../../test_projects/proj0')

		// Use cp.spawn / cp.exec for custom setup
		cp.spawnSync(
			cliPath,
			[...args, '--trace-deprecation', '--install-extension', packagedExtensionPath],
			// [...args, '--install-extension', packagedExtensionPath],
			{
				encoding: 'utf-8',
				stdio: 'inherit'
			}
		)

		// Run the extension test
		await runTests({
			// Use the specified `code` executable
			vscodeExecutablePath,
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [
				projDir,
				'--trace-deprecation'
			]
		})
	} catch (err) {
		console.error('Failed to run tests')
		process.exit(1)
	}
	console.log("[installAndRun] success!  version=" + version)
}

main()
