import * as path from 'path';
import { runTests } from '@vscode/test-electron'
import * as Config from './createTestConfig'

async function main() {
	const config = Config.getTestConfig()

	for (const conf of config) {
		await testProject(conf.projName, conf.workspaceFolder, conf.launchArgs)
	}
}

async function testProject(projName: string, projDir?: string, launchArgs?: string[]) {
	if(!projDir) {
		projDir = projName
	}

	const extensionDevelopmentPath = path.resolve(__dirname, '../../');
	console.log("extensionDevelopmentPath=" + extensionDevelopmentPath)
	try {
		const extensionTestsPath = path.resolve(__dirname, './suite/index_' + projName)
		console.log("extensionTestsPath=" + extensionTestsPath)

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
		process.exit(1);
	} finally {
		console.log("[runTest.ts testProject] finally")
	}
}

main()
