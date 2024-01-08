
interface TestConfig {
	projName: string
	label: string
	files: string
	workspaceFolder: string
	mocha: {
		ui: string
		timeout: number
	}
	launchArgs: string[]
}

function createTestConfig (projName: string, workspaceFolder?: string, timeout?: number) {
	if (!workspaceFolder || workspaceFolder == '') {
		workspaceFolder = projName
	}

	if (!timeout || timeout == 0) {
		timeout = 15000
	}

	const launchArgs: string[] = []
	if (projName != "DebugLines" &&
		projName != "proj3" &&
		projName != "proj4" &&
		projName != "proj9") {
		launchArgs.push('--disable-extensions')
	}

	const retVal: TestConfig = {
		projName: projName,
		label: 'extension tests - ' + projName,
		files: 'out/test/**/*' + projName + '.test.js',
		workspaceFolder: './test_projects/' + workspaceFolder,
		mocha: {
			ui: 'tdd',
			timeout: timeout
		},
		launchArgs: launchArgs
	}

	return retVal
}

export function getTestConfig () {
	const testConfig: TestConfig[] = []
	// Unit Tests
	testConfig.push(createTestConfig('DebugLines', undefined, 30000))
	testConfig.push(createTestConfig('TestProfileParser'))

	// Folders
	testConfig.push(createTestConfig('proj0'))
	testConfig.push(createTestConfig('proj1'))
	testConfig.push(createTestConfig('proj2'))
	testConfig.push(createTestConfig('proj3', 'proj3_debugLines'))
	testConfig.push(createTestConfig('proj4'))
	testConfig.push(createTestConfig('proj5', 'proj5_suites'))
	testConfig.push(createTestConfig('proj6', 'proj6_dot_dir'))
	testConfig.push(createTestConfig('proj7', 'proj7_load_performance', 50000))
	testConfig.push(createTestConfig('proj8', 'proj8_custom_command'))
	testConfig.push(createTestConfig('proj9'))

	// // Workspaces
	testConfig.push(createTestConfig('workspace0', 'workspace0.code-workspace'))
	testConfig.push(createTestConfig('workspace1', 'workspace1.code-workspace'))

	return testConfig
}
