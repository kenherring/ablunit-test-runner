import * as path from 'path';
import { runTests } from '@vscode/test-electron';


async function main() {
	await testProject("proj0")
	await testProject("proj1")
	await testProject("proj2")
	await testProject("proj3", "proj3_debugLines")
}

async function testProject(projName: string, projDir?: string) {
	if (!projDir) {
		projDir = projName
	}
	const extensionDevelopmentPath = path.resolve(__dirname, '../../');
	console.log("extensionDevelopmentPath=" + extensionDevelopmentPath)
	try {
		const extensionTestsPath = path.resolve(__dirname, './suite/index_' + projName);
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [
				'--disable-extensions',
				'test_projects/' + projDir,
			]
		});
	} catch (err) {
		console.error('[runTest.ts] Failed to run tests, err=' + err);
		process.exit(1);
	} finally {
		console.log("finally")
	}
}

main()
