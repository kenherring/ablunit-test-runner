import * as fs from 'fs'
import * as path from 'path'
import { runTests } from '@vscode/test-electron'
import { ITestConfig } from './createTestConfig'

async function main () {
	console.log('[runTest.ts main] starting...')
	const testConfig: ITestConfig[] = <ITestConfig[]>JSON.parse(fs.readFileSync('./.vscode-test.config.json', 'utf8'))

	let projToRun: string | undefined = undefined
	projToRun = process.env.ABLUNIT_TEST_RUNNER_PROJECT_NAME
	for (const conf of testConfig) {
		if (!projToRun || conf.projName === projToRun) {
			await testProject(conf.projName, conf.workspaceFolder, conf.launchArgs)
		}
	}
}

async function testProject (projName: string, projDir?: string, launchArgs: string[] = []) {
	if(!projDir) {
		projDir = projName
	}

	const extensionDevelopmentPath: string = path.resolve(__dirname, '../../')
	const extensionTestsPath = path.resolve(__dirname)
	const testingEnv: { [key: string]: string | undefined } = {
		ABLUNIT_TEST_RUNNER_UNIT_TESTING: 'true',
		ABLUNIT_TEST_RUNNER_PROJECT_NAME: projName
	}

	try {
		const args: string[] = [
			projDir,
			'--disable-gpu',
			// '--verbose',
			// '--telemetry'
		]
		args.push(...launchArgs)

		console.log('[runTest.ts testProject] (projName=' + projName + ') running tests with args=')
		console.debug(" -- extensionDevelopmentPath=" + extensionDevelopmentPath)
		console.debug(" -- extensionTestsPath=" + extensionTestsPath)
		console.debug(" -- testingEnv=" + JSON.stringify(testingEnv))

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: args,
			extensionTestsEnv: testingEnv
		})
		console.log("[runTest.ts testProject] (projName=" + projName + ") tests completed successfully!")
	} catch (err) {
		console.error('[runTest.ts testProject] (projName=' + projName + ') failed to run tests, err=' + err)
		process.exit(1)
	} finally {
		console.log('[runTest.ts testProject] (projName=' + projName + ') finally')
	}
}

main().then(() => {
	console.log('[runTest.ts main] completed successfully!')
}, (err) => {
	console.error('[runTest.ts main] Failed to run tests, err=' + err)
	process.exit(1)
})
