// This file was adapted from the VSCode docs:
//    * https://code.visualstudio.com/api/working-with-extensions/testing-extension#the-test-runner-script
// Instead of testing as a development extension this loads a dummy extension,
// installs the packaged ablunit-test-runner extension, and runs a test.
// This gives confidence that the packaged extension is functional.

import * as cp from 'child_process'
import * as path from 'path'
import { globSync } from 'glob'
import { copyFileSync, existsSync } from 'fs'
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron'

const file = 'dummy-ext/runTest.ts'
let packagedExtensionPath = path.resolve(__dirname, '../../../ablunit-test-runner-*.*.*.vsix')

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
	const g = globSync('ablunit-test-runner-*.vsix', { cwd: '..' })
	if (g.length !== 1) {
		throw new Error('Expected exactly one ablunit-test-runner-*.vsix file, found ' + g.length + ' in ' + packagedExtensionPath)
	}

	packagedExtensionPath = path.resolve('..', g[0])
	if (!existsSync(packagedExtensionPath)) {
		throw new Error('Extension bundle does not exist! path=' + packagedExtensionPath)
	}
	return path.resolve(__dirname, '../../../test_projects/proj4')
}

function copyExtensionFile() {
	let packagedExtensionPattern = path.resolve(__dirname, '../../../ablunit-test-runner-*.*.*.vsix')
	const g = globSync('ablunit-test-runner-*.vsix', { cwd: '..' })
	const packagedExtensionPath = path.resolve('..', g[0])
	if (g.length !== 1) {
		throw new Error('Expected exactly one ablunit-test-runner-*.vsix file, found ' + g.length + ' in ' + packagedExtensionPath)
	}
	console.log('copy extension file ' + packagedExtensionPath + ' to ' + path.resolve('.vscode-test', 'extensions', g[0]))
	copyFileSync(packagedExtensionPath, path.resolve('.vscode-test', 'extensions', g[0]))
	return packagedExtensionPath
}

function installOpenEdgeExtension (vscodeExecutablePath: string, extensionId: string) {
	const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)
	console.log('[runTest.ts runTest] installing extensions ' + extensionId + '... (cliPath=' + cliPath + ')')
	// Use cp.spawn / cp.exec for custom setup
	// cp.spawnSync(cliPath, ['--install-extension', extensionId])
	cp.execSync(cliPath + ' --list-extensions')
	cp.execSync(cliPath + ' --install-extension=' + packagedExtensionPath)
	cp.execSync(cliPath + ' --list-extensions')
	console.log('[runTest.ts runTest] installed extensions ' + extensionId + '!')
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
		// installOpenEdgeExtension(vscodeExecutablePath, packagedExtensionPath)
		// copyExtensionFile()
		process.env['EXTENSION_VSIX_PATH'] = packagedExtensionPath

		const launchArgs: string[] = []
		launchArgs.push(projDir)
		launchArgs.push('--log=verbose')
		// launchArgs.push('--verbose')
		// launchArgs.push('--telemetry')
		// launchArgs.push('--disable-gpu')
		// launchArgs.push('--trace-deprecation')
		// if (version === 'insiders') {
		// 	launchArgs.push('--enable-proposed-api=kherring.ablunit-test-runner')
		// }
		// launchArgs.push('--disable-extensions')

		console.log('[' + file + ' runTest] (projName=' + projName + ') running tests with args=')
		console.debug(' -- cwd=' + __dirname)
		console.debug(' -- vscodeExecutablePath=' + vscodeExecutablePath)
		// D:\ablunit-test-runner\dummy-ext\.vscode-test\vscode-win32-x64-archive-1.92.0\bin\code.cmd
		// D:\ablunit-test-runner\dummy-ext\.vscode-test\vscode-win32-x64-archive-1.92.0\Code.exe
		console.debug(' -- extensionDevelopmentPath=' + extensionDevelopmentPath)
		console.debug(' -- extensionTestsPath=' + extensionTestsPath)
		console.debug(' -- testingEnv=' + JSON.stringify(testingEnv))

		await runTests({
			vscodeExecutablePath,
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: launchArgs,
			extensionTestsEnv: testingEnv,
			version: version,
		})
		console.log('[' + file + ' runTest] (projName=' + projName + ') tests completed successfully!')
	} catch (err) {
		console.error('[' + file + ' runTest] (projName=' + projName + ') failed to run tests, err=' + err)
		throw new Error('Failed to run tests! err=' + err)
	} finally {
		console.log('[' + file + ' runTest] (projName=' + projName + ') finally')
	}
	console.log('[' + file + ' runTest] success!  version=' + version)
}

main().then(() => {
	console.log('[' + file + ' main] completed successfully!')
}, (err) => {
	console.error('[' + file + ' main] Failed to run tests, err=' + err)
	process.exit(1)
})
