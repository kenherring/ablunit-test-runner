import * as path from 'path';
import { runTests } from '@vscode/test-electron';


async function main() {
	// await testProject("proj0")
	// await testProject("proj1")
	// await testProject("proj2")
	await testProject("proj3", "proj3_debugLines")
	// await testProject("proj4")
}

async function testProject(projName: string, projDir?: string) {
	if (!projDir) {
		projDir = projName
	}
	const extensionDevelopmentPath = path.resolve(__dirname, '../../');
	try {
		const extensionTestsPath = path.resolve(__dirname, './suite/index_' + projName)

		let args = [
			'--disable-extensions',
			'test_projects/' + projDir,
		]
		if (projName === "proj3" || projName === "proj4") {
			args = [
				'test_projects/' + projDir
			]
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
