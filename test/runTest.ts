/* eslint-disable no-console */
import * as cp from 'child_process'
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron'
import { ITestConfig, getTestConfig } from './createTestConfig'
import { TestOptions } from '@vscode/test-electron/out/runTest'
import { vscodeVersion } from 'ABLUnitCommon'

const file = 'runTest.ts'

async function main () {
	console.log('[' + file + ' main] starting...')

	let version: vscodeVersion = 'stable'
	if (process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION']) {
		version = process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] as vscodeVersion
	}

	console.log('[' + file + ' main] get config for version=' + version)
	const testConfig = getTestConfig(version)

	let projToRun: string | undefined = undefined
	projToRun = process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME']

	console.log('[' + file + ' main] projToRun=' + projToRun)
	let testCount = 0
	for (const conf of testConfig) {
		if (!projToRun || conf.projName === projToRun) {
			testCount++
			console.log('[' + file + ' main] starting tests in vscode')
			await runTest(conf)
		}
	}
	console.log('[' + file + ' main] tests completed successfully! testCount=' + testCount)
	if (testCount === 0) {
		console.error('[' + file + ' main] no tests found!')
		process.exit(1)
	}
}

function installExtension (vscodeExecutablePath: string, extensionId: string) {
	console.log('[' + file + ' installOpenEdgeExtension] installing OpenEdge extensions...')
	const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)
	// Use cp.spawn / cp.exec for custom setup
	// see `code --help` for cli options that can be used here
	cp.spawnSync(
		cliPath,
		[...args, '--install-extension', extensionId],
		{ encoding: 'utf-8', stdio: 'inherit' }
	)
}

async function runTest (conf: ITestConfig) {
	// const extensionDevelopmentPath: string = path.resolve(__dirname, '../../')
	// const extensionTestsPath = path.resolve(__dirname)
	const vscodeExecutablePath = await downloadAndUnzipVSCode(conf.version)

	installExtension(vscodeExecutablePath, 'riversidesoftware.openedge-abl-lsp')
	/*
	if (conf.version === 'stable' || conf.version === 'proposedapi') {
		installExtension(vscodeExecutablePath, 'ablunit-test-runner-' + getExtensionVersion() + '.vsix')
	} else if (conf.version === 'insiders') {
		installExtension(vscodeExecutablePath, 'ablunit-test-runner-insiders-' + getExtensionVersion() + '.vsix')
	}
	*/

	try {
		console.log('[' + file + ' runTest] running tests with args=')
		console.debug(' -- cwd=' + __dirname)
		console.debug(' -- testName=' + conf.projName)
		console.debug(' -- testProjetDir=' + conf.launchArgs[0])
		// console.debug(' -- extensionDevelopmentPath=' + extensionDevelopmentPath)
		// console.debug(' -- extensionTestsPath=' + extensionTestsPath)
		console.debug(' -- launchArg extensionTestsPath=' + conf.launchArgs[1])
		console.debug(' -- testingEnv=' + JSON.stringify(conf.env))
		console.debug(' -- version=' + conf.version)

		const config: TestOptions = {
			vscodeExecutablePath,
			extensionDevelopmentPath: conf.extensionDevelopmentPath,
			extensionTestsPath: conf.extensionTestsPath, // index.ts
			extensionTestsEnv: conf.env,
			launchArgs: conf.launchArgs,
			version: conf.version
		}
		await runTests(config)
		console.log('[' + file + ' runTest] (projName=' + conf.projName + ') tests completed successfully!')
	} catch (err) {
		console.error('[' + file + ' runTest] (projName=' + conf.projName + ') failed to run tests, err=' + err)
		throw new Error('Failed to run tests! err=' + err)
	} finally {
		console.log('[' + file + ' runTest] (projName=' + conf.projName + ') finally')
	}
	console.log('[' + file + ' runTest] (projName=' + conf.projName + ') success!  version=' + conf.version)
}

main().then(() => {
	console.log('[' + file + '] completed successfully!')
}, (err) => {
	console.error('[' + file + '] failed to run tests, err=' + err)
	process.exit(1)
})
