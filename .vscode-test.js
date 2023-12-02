const { defineConfig } = require('@vscode/test-cli');

function createTestConfig(projName, workspaceFolder, timeout) {
	if (workspaceFolder == '') {
		workspaceFolder = `./test_projects/${projName}`;
	};
	if (timeout == 0) {
		timeout = 20000;
	};
	const retVal = {
		label: `extension tests - ${projName}`,
		files: `out/test/**/*.${projName}.test.js`,
		workspaceFolder: workspaceFolder,
		mocha: {
			ui: 'tdd',
			timeout: timeout
		},
		launchArgs: [
			'--disable-extensions'
		]
	};

	// console.log("retVal: ", retVal)
	return retVal;
}

function getTestConfig () {
	const testConfig = []
	testConfig.push(createTestConfig('proj0', '', 0));
	testConfig.push(createTestConfig('proj1', '', 0));
	testConfig.push(createTestConfig('proj2', '', 0));
	testConfig.push(createTestConfig('proj3', './test_projects/proj3_debugLines', 0));
	testConfig.push(createTestConfig('proj4', '', 0));
	testConfig.push(createTestConfig('proj5', './test_projects/proj5_suites', 0));
	testConfig.push(createTestConfig('proj7', './test_projects/proj7_load_performance', 50000));
	return testConfig;
}

module.exports = defineConfig(getTestConfig());
