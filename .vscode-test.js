let version = 'stable'
if (process.argv.includes('--insiders')) {
	version = 'insiders'
}

// const { getTestConfig } = require('./dist/test/createTestConfig.js')
// const testConfigStable = getTestConfig('stable')
// const testConfig = testConfigStable

const { defineConfig } = require('@vscode/test-cli')
// module.exports = defineConfig(testConfig)
module.exports = defineConfig({
	"projName": "DebugLines",
	// "label": "extension tests - DebugLines",
	"files": "test\\suite\\DebugLines.test.ts",
	"workspaceFolder": "test_projects\\DebugLines",
	"extensionDevelopmentPath": "d:\\ablunit-test-runner",
	"extensionTestsPath": "./dist/test/index.test",
	"mocha": {
		"ui": "tdd",
		"retries": 1,
		"timeout": 15000,
		// "reporterOptions": {
		// 	"reporterEnabled": "spec, mocha-junit-reporter, mocha-reporter-sonarqube",
		// 	"mochaJunitReporterReporterOptions": {
		// 		"mochaFile": "d:\\ablunit-test-runner/artifacts/stable-0.0.0/mocha_results_junit_test\\allSuites.test.ts.xml"
		// 	},
		// 	"mochaReporterSonarqubeReporterOptions": {
		// 		"filename": "d:\\ablunit-test-runner/artifacts/stable-0.0.0/mocha_results_sonar_test\\allSuites.test.ts.xml"
		// 	}
		// }
	},
	"launchArgs": [
		"test_projects\\DebugLines",
		// "test\\allSuites.test.ts",
		// "--disable-gpu",
		// "--disable-telemetry",
		// "--disable-updates",
		// "--log=debug",
		// "--no-cached-data",
		// "--skip-release-notes",
		// "--skip-welcome",
		// "--install-extension=riversidesoftware.openedge-abl-lsp",
		"--disable-extensions"
	],
	// "version": "stable",
	"env": {
		"ABLUNIT_TEST_RUNNER_UNIT_TESTING": "true",
		// "ABLUNIT_TEST_RUNNER_PROJECT_NAME": "test\\allSuites.test.ts",
		"ABLUNIT_TEST_RUNNER_VSCODE_VERSION": "stable"
	}
})
