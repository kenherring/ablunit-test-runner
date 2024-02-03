/* eslint-disable no-console */
import * as cp from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron'
import { ITestConfig } from './createTestConfig'

async function main () {
	console.log('[runTest.ts main] starting...')
	const testConfig: ITestConfig[] = JSON.parse(fs.readFileSync('./.vscode-test.config.json', 'utf8')) as ITestConfig[]

	let projToRun: string | undefined = undefined
	projToRun = process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME']
	console.log('[runTest.ts main] projToRun=' + projToRun)
	let suiteCount = 0
	let passedCount = 0
	let failedCount = 0
	for (const conf of testConfig) {
		if (!projToRun || conf.projName === projToRun) {
			suiteCount++
			const passed = await testProject(conf.projName, conf.workspaceFolder, conf.launchArgs)
			if (passed) {
				passedCount++
			} else {
				failedCount++
			}
		}
	}
	console.log('[runTest.ts main] suiteCount=' + suiteCount + ', passedCount=' + passedCount + ', failedCount=' + failedCount)
	if (suiteCount === 0) {
		console.error('[runTest.ts main] no tests found!')
		process.exit(1)
	}
	if (failedCount != 0) {
		console.error('[runTest.ts main] ' + failedCount + '/' + suiteCount + ' test suites failed!')
		process.exit(1)
	}
}

function installOpenEdgeExtension (vscodeExecutablePath: string) {
	console.log('[installAndRun.ts runTest] installing OpenEdge extensions...')
	const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)
	// Use cp.spawn / cp.exec for custom setup
	cp.spawnSync(
		cliPath,
		[...args, '--install-extension', 'riversidesoftware.openedge-abl'],
		{ encoding: 'utf-8', stdio: 'inherit' }
	)
}

async function testProject (projName: string, projDir?: string, launchArgs: string[] = []) {
	if(!projDir) {
		projDir = projName
	}

	const version = 'stable'
	const extensionDevelopmentPath: string = path.resolve(__dirname, '../../')
	const extensionTestsPath = path.resolve(__dirname)
	const vscodeExecutablePath = await downloadAndUnzipVSCode(version)
	const testingEnv: { [key: string]: string | undefined } = {
		ABLUNIT_TEST_RUNNER_UNIT_TESTING: 'true',
		ABLUNIT_TEST_RUNNER_PROJECT_NAME: projName
	}

	try {
		installOpenEdgeExtension(vscodeExecutablePath)

		const args: string[] = [
			projDir,
			'--disable-gpu',
			// '--verbose',
			// '--telemetry'
		]
		args.push(...launchArgs)

		console.log('[runTest.ts testProject] (projName=' + projName + ') running tests with args=')
		console.debug(' -- cwd=' + __dirname)
		console.debug(' -- extensionDevelopmentPath=' + extensionDevelopmentPath)
		console.debug(' -- extensionTestsPath=' + extensionTestsPath)
		console.debug(' -- testingEnv=' + JSON.stringify(testingEnv))

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: args,
			extensionTestsEnv: testingEnv
		})
		console.log('[runTest.ts testProject] (projName=' + projName + ') tests completed successfully!')
	} catch (err) {
		console.error('[runTest.ts testProject] (projName=' + projName + ') failed to run tests, err=' + err)
		return false
	} finally {
		console.log('[runTest.ts testProject] (projName=' + projName + ') finally')
	}
	return true
}

main().then(() => {
	console.log('[runTest.ts main] completed successfully!')
}, (err) => {
	console.error('[runTest.ts main] Failed to run tests, err=' + err)
	process.exit(1)
})
