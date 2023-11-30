import * as path from 'path';
import { runTests } from '@vscode/test-electron'

async function main() {
	await testProject("proj0")
	await testProject("proj1")
	await testProject("proj2")
	await testProject("proj3", "proj3_debugLines")
	await testProject("proj4")
	await testProject("proj5", "proj5_suites")
	await testProject("proj7", "proj7_load_performance")
}

async function testProject(projName: string, projDir?: string) {
	if (!projDir) {
		projDir = projName
	}
	const extensionDevelopmentPath = path.resolve(__dirname, '../../');
	console.log("extensionDevelopmentPath=" + extensionDevelopmentPath)
	try {
		const extensionTestsPath = path.resolve(__dirname, './suite/index_' + projName)
		console.log("extensionTestsPath=" + extensionTestsPath)

		const args = [
			'test_projects/' + projDir,
			'--disable-gpu',
			// '--verbose',
			// '--telemetry'
		]
		if (projName !== "proj3" && projName !== "proj4") {
			args.push('--disable-extensions')
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
