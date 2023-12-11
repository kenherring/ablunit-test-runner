import * as path from 'path'
import { runTests } from '@vscode/test-electron'
import { getTestConfig } from './createTestConfig'

async function main() {
	const config = getTestConfig()

	for (const conf of config) {
		if (conf.projName == 'Parsers') {
			console.log("conf = " + JSON.stringify(conf))
			await testProject(conf.projName, conf.workspaceFolder, conf.launchArgs, conf.indexFile)
		}
	}
}

async function testProject(projName: string, projDir?: string, launchArgs?: string[], indexFile: string = './index') {
	if(!projDir) {
		projDir = projName
	}

	const extensionDevelopmentPath = path.resolve(__dirname, '../../')
	const extensionTestsPath = path.resolve(__dirname, indexFile)
	try {
		const args: string[] = [
			projDir,
			'--disable-gpu',
			// '--verbose',
			// '--telemetry'
		]

		if (launchArgs && launchArgs.length > 0) {
			for (const arg of launchArgs) {
				args.push(arg)
			}
		}

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: args
		})
	} catch (err) {
		console.error('[runTest.ts testProject] Failed to run tests, err=' + err)
		process.exit(1)
	} finally {
		console.log("[runTest.ts testProject] finally")
	}
}

main().then(() => {
	console.log("[runTest.ts main] completed successfully!")
}, (err) => {
	console.error('[runTest.ts main] Failed to run tests, err=' + err)
	process.exit(1)
})
