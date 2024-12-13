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

const file = 'dummy-ext/runTest.ts'
let packagedExtensionPath = path.resolve(__dirname, '../../../ablunit-test-runner-*.vsix')

async function main() {
	const projName = getProjName()
	console.log('[' + file + ' main] starting... (projName=' + projName + ')')

	let testCount = 0
	for(const version of ['stable', 'insiders']) {
		testCount++
		console.log('[' + file + ' main] starting tests in vscode, version=\'' + version + '\'')
		await runTest(version, projName)
	}
	console.log('[' + file + ' main] tests completed successfully! testCount=' + testCount)

	if (testCount === 0) {
		console.error('[' + file + ' main] no tests found!')
		process.exit(1)
	}
}

function getProjName() {
	const g = globSync(packagedExtensionPath)
	if (g.length !== 2) {
		throw new Error('Expected exactly two ablunit-test-runner-*.vsix file, found ' + g.length)
	}

	packagedExtensionPath = g[0]
	if (!existsSync(packagedExtensionPath)) {
		throw new Error('Extension bundle does not exist! path=' + packagedExtensionPath)
	}
	return path.resolve(__dirname, '../../../test_projects/proj4')
}

function installOpenEdgeExtension (vscodeExecutablePath: string, extensionId: string) {
	console.log('[runTest.ts runTest] installing OpenEdge extensions...')
	const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)
	// Use cp.spawn / cp.exec for custom setup
	cp.spawnSync(
		cliPath,
		[...args, '--install-extension', extensionId],
		{ encoding: 'utf-8', stdio: 'inherit' }
	)
}

async function runTest(version: string, projName: string, projDir?: string) {
	if(!projDir) {
		projDir = projName
	}

	console.log('[installAndRun] start test run.  version=' + version)

	const extensionDevelopmentPath = path.resolve(__dirname, '../../')
	const extensionTestsPath = path.resolve(__dirname, './index')
	const vscodeExecutablePath = await downloadAndUnzipVSCode(version)
	const testingEnv: { [key: string]: string | undefined } = {}

	try {
		installOpenEdgeExtension(vscodeExecutablePath, packagedExtensionPath)

		const launchArgs: string[] = []
		launchArgs.push(projDir)
		launchArgs.push('--log=debug')
		// launchArgs.push('--verbose')
		// launchArgs.push('--telemetry')
		// launchArgs.push('--disable-gpu')
		// launchArgs.push('--trace-deprecation')
		if (version === 'insiders') {
			launchArgs.push('--enable-proposed-api=kherring.ablunit-test-runner')
		}
		// launchArgs.push('--disable-extensions')

		console.log('[' + file + ' runTest] (projName=' + projName + ') running tests with args=')
		console.debug(' -- cwd=' + __dirname)
		console.debug(' -- extensionDevelopmentPath=' + extensionDevelopmentPath)
		console.debug(' -- extensionTestsPath=' + extensionTestsPath)
		console.debug(' -- testingEnv=' + JSON.stringify(testingEnv))

		await runTests({
			vscodeExecutablePath,
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: launchArgs,
			extensionTestsEnv: testingEnv,
			version: version
		})
		console.log('[' + file + ' runTest] (projName=' + projName + ') tests completed successfully!')
	} catch (e: unknown) {
		console.error('[' + file + ' runTest] (projName=' + projName + ') failed to run tests, e=' + e)
		throw new Error('Failed to run tests! e=' + e)
	} finally {
		console.log('[' + file + ' runTest] (projName=' + projName + ') finally')
	}
	console.log('[' + file + ' runTest] success!  version=' + version)
}

main().then(() => {
	console.log('[' + file + ' main] completed successfully!')
}, (e: unknown) => {
	console.error('[' + file + ' main] Failed to run tests, e=' + e)
	process.exit(1)
})
