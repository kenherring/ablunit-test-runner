const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig([
	{
		label: 'extension tests - proj0',
		files: 'out/test/**/*.proj0.test.js',
		workspaceFolder: './test_projects/proj0',
		mocha: {
			ui: 'tdd',
			timeout: 20000
		},
		launchArgs: [
			'--disable-extensions'
		]
	},
	{
		label: 'extension tests - proj1',
		files: 'out/test/**/*.proj1.test.js',
		workspaceFolder: './test_projects/proj1',
		mocha: {
			ui: 'tdd',
			timeout: 20000
		},
		launchArgs: [
			'--disable-extensions'
		]
	},
	{
		label: 'extension tests - proj2',
		files: 'out/test/**/*.proj2.test.js',
		workspaceFolder: './test_projects/proj2',
		mocha: {
			ui: 'tdd',
			timeout: 20000
		},
		launchArgs: [
			'--disable-extensions'
		]
	},
	{
		label: 'extension tests - proj3',
		files: 'out/test/**/*.proj3.test.js',
		workspaceFolder: './test_projects/proj3_debugLines',
		mocha: {
			ui: 'tdd',
			timeout: 20000
		},
		launchArgs: []
	},
	{
		label: 'extension tests - proj4',
		files: 'out/test/**/*.proj4.test.js',
		workspaceFolder: './test_projects/proj4',
		mocha: {
			ui: 'tdd',
			timeout: 20000
		},
		launchArgs: []
	},
	{
		label: 'extension tests - proj5 (unit tests)',
		files: 'out/test/**/*.proj5.test.js',
		workspaceFolder: './test_projects/proj5_suites',
		mocha: {
			ui: 'tdd',
			timeout: 30000
		}
	},
	{
		label: 'extension tests - proj7 (load performance)',
		files: 'out/test/**/*.proj7.test.js',
		workspaceFolder: './test_projects/proj7_load_performance',
		mocha: {
			ui: 'tdd',
			timeout: 30000
		}
	}
]);
