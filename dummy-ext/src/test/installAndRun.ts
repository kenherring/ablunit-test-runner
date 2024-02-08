// This file was adapted from the VSCode docs:
//    * https://code.visualstudio.com/api/working-with-extensions/testing-extension#the-test-runner-script
// Instead of testing as a development extension this loads a dummy extension,
// installs the packaged ablunit-test-runner extension, and runs a test.
// This gives confidence that the packaged extension is functional.

import * as cp from 'child_process'
import * as path from 'path'
import { globSync } from 'glob'
import { existsSync } from 'fs'
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron'

async function main() {
	console.log("[main] starting tests in vscode, version='stable'")
	await runTest('stable')
	console.log("[main] starting tests in vscode, version='insiders'")
	await runTest('insiders')
	console.log("[main] tests completed successfully!")
}

async function runTest(version: string) {
	console.log("[installAndRun] start test run.  version=" + version)
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../')
		const extensionTestsPath = path.resolve(__dirname, './index')
		const vscodeExecutablePath = await downloadAndUnzipVSCode(version)
		const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)

		const g = globSync(path.resolve(__dirname, '../../../', 'ablunit-test-runner-*.vsix'))
		if (g.length != 3) {
			throw new Error("Expected exactly three ablunit-test-runner-*.vsix files, found " + g.length)
		}

		const packagedExtensionPath = g[0]
		if (!existsSync(packagedExtensionPath)) {
			throw new Error("Extension bundle does not exist! '" + packagedExtensionPath + "'")
		}
		// const projDir = path.resolve(__dirname, '../../../test_projects/proj0')
		// const projDir = path.resolve(__dirname, '../../../test_projects/proj1')
		const projDir = path.resolve(__dirname, '../../../test_projects/proj4')

		console.log("[installAndRun.ts runTest] cp.spawnSync")
		// Use cp.spawn / cp.exec for custom setup
		cp.spawnSync(
			cliPath,
			[...args, '--install-extension', packagedExtensionPath],
			{ encoding: 'utf-8', stdio: 'inherit' }
		)

		console.log('[installAndRun.ts runTest] await runTests (projDir=' + projDir + ')')
		console.log('[installAndRun.ts runTest] -- extensionDevelopmentPath=' + extensionDevelopmentPath)
		console.log('[installAndRun.ts runTest] -- extensionTestsPath=' + extensionTestsPath)
		await runTests({
			vscodeExecutablePath,
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [ projDir, '--log', 'debug' ]
		})
	} catch (err) {
		throw new Error("Failed to run tests! err=" + err)
	}
	console.log("[installAndRun] success!  version=" + version)
}

main().catch(err => {
	console.error("ERROR running tests:" + err)
	process.exit(1)
})
