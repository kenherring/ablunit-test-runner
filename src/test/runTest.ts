import * as path from 'path';
import { runTests } from '@vscode/test-electron';


async function main() {
	await testProject("proj1")
	await testProject("proj2")
	await testProject("proj3")
}

async function testProject(projName: string) {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');
	try {
		const extensionTestsPath = path.resolve(__dirname, './suite/index_' + projName);
		await runTests({
				extensionDevelopmentPath,
				extensionTestsPath,
				launchArgs: [
					'--disable-extensions',
					'test_projects/' + projName,
				]
		});
	} catch (err) {
		console.error("ERR: " + err);
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main()
