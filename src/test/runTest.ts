/* eslint-disable no-console */
import * as cp from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron'
import { ITestConfig } from './createTestConfig'

const file = 'runTest.ts'
const version: 'stable' | 'insiders' = 'insiders'

async function main () {
	console.log('[' + file + ' main] starting...')
	const testConfig: ITestConfig[] = JSON.parse(fs.readFileSync('./.vscode-test.config.json', 'utf8')) as ITestConfig[]

	let projToRun: string | undefined = undefined
	projToRun = process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME']
	console.log('[' + file + ' main] projToRun=' + projToRun)
	let testCount = 0
	for (const conf of testConfig) {
		if (!projToRun || conf.projName === projToRun) {
			testCount++
			console.log('[' + file + ' main] starting tests in vscode, version=\'' + version + '\'')
			await runTest(version, conf.projName, conf.workspaceFolder)
		}
	}
	console.log('[' + file + ' main] tests completed successfully! testCount=' + testCount)
	if (testCount === 0) {
		console.error('[' + file + ' main] no tests found!')
		process.exit(1)
	}
}

function installOpenEdgeExtension (vscodeExecutablePath: string, extensionId: string) {
	console.log('[' + file + ' runTest] installing OpenEdge extensions...')
	const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)
	// Use cp.spawn / cp.exec for custom setup
	cp.spawnSync(
		cliPath,
		[...args, '--install-extension', extensionId],
		{ encoding: 'utf-8', stdio: 'inherit' }
	)
}

async function runTest (version: string, projName: string, projDir?: string) {
	if(!projDir) {
		projDir = projName
	}

	const extensionDevelopmentPath: string = path.resolve(__dirname, '../../')
	const extensionTestsPath = path.resolve(__dirname)
	const vscodeExecutablePath = await downloadAndUnzipVSCode(version)
	const testingEnv: { [key: string]: string | undefined } = {
		ABLUNIT_TEST_RUNNER_UNIT_TESTING: 'true',
		ABLUNIT_TEST_RUNNER_PROJECT_NAME: projName,
		ABLUNIT_TEST_RUNNER_VSCODE_VERSION: version
	}

	try {
		installOpenEdgeExtension(vscodeExecutablePath, 'riversidesoftware.openedge-abl')

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
		launchArgs.push(...launchArgs)

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
