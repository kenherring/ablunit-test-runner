
interface TestConfig {
	projName: string;
	label: string;
	files: string;
	workspaceFolder: string;
	mocha: {
		ui: string;
		timeout: number;
	};
	launchArgs: string[];
}

function createTestConfig(projName: string, workspaceFolder?: string, timeout?: number) {
	if (!workspaceFolder || workspaceFolder == '') {
		workspaceFolder = projName;
	}

	if (!timeout || timeout == 0) {
		timeout = 10000;
	}

	const launchArgs: string[] = []
	if (projName !== "proj3" && projName !== "proj4") {
		launchArgs.push('--disable-extensions')
	}

	const retVal: TestConfig = {
		projName: projName,
		label: 'extension tests - ' + projName,
		files: 'out/test/**/extension.' + projName + '.test.js',
		workspaceFolder: './test_projects/' + workspaceFolder,
		mocha: {
			ui: 'tdd',
			timeout: timeout
		},
		launchArgs: launchArgs
	}

	return retVal;
}

export function getTestConfig () {
	const testConfig = []
	// Folders
	testConfig.push(createTestConfig('proj0'));
	testConfig.push(createTestConfig('proj1'));
	testConfig.push(createTestConfig('proj2', '', 0));
	testConfig.push(createTestConfig('proj3', 'proj3_debugLines', 0));
	testConfig.push(createTestConfig('proj4', '', 0));
	testConfig.push(createTestConfig('proj5', 'proj5_suites', 0));
	testConfig.push(createTestConfig('proj7', 'proj7_load_performance', 50000));

	// Workspaces
	testConfig.push(createTestConfig('workspace0', 'workspace0.code-workspace',0));
	testConfig.push(createTestConfig('workspace1', 'workspace1.code-workspace',0));

	return testConfig;
}