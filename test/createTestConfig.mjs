/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-console */
// @ts-nocheck

import { defineConfig } from '@vscode/test-cli'
import { fileURLToPath } from 'url'
import * as path from 'path'
import * as fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const enableExtensions = []
enableExtensions.push('DebugLines')
enableExtensions.push('proj2')
enableExtensions.push('proj3')
enableExtensions.push('proj4')
enableExtensions.push('proj7A')
enableExtensions.push('proj7B')
enableExtensions.push('proj8')
enableExtensions.push('proj9')

// let version = 'insiders'
let vsVersion = 'stable'
if (process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION']) {
	vsVersion = process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION']
}
if (vsVersion !== 'insiders' && vsVersion !== 'stable') {
	throw new Error('Invalid version: ' + vsVersion)
}

let oeVersion = '12.2.12'
if (process.env['ABLUNIT_TEST_RUNNER_OE_VERSION']) {
	oeVersion = process.env['ABLUNIT_TEST_RUNNER_OE_VERSION']
}


function writeConfigToFile (name, config) {
	fs.writeFileSync('.vscode-test.' + name + '.json.bk', JSON.stringify(config, null, 4).replace('    ', '\t'))
}

function getTestConfig (projName) {
	const args = [
		// 'test_projects/' + projName, // workspaceFolder is set in the config
		'--disable-gpu',
		// '--reuse-window',
		// '--user-data-dir=./test_projects/' + projName + '/.vscode-data/',
		// '--profile=' + projName,
		// '--sync=off',
		// '--telemetry',
		// '--log=debug',
		// '--log=verbose',
		// '--verbose',
	]
	if (!enableExtensions.includes(projName)) {
		args.push('--disable-extensions')
	}

	let ws = './test_projects/' + projName
	if (projName === 'proj3') {
		ws = ws + '_debugLines'
	} else if(projName === 'proj5') {
		ws = ws + '_suites'
	} else if(projName === 'proj6') {
		ws = ws + '_dot_dir'
	} else if(projName === 'proj7A' || projName === 'proj7B') {
		ws = 'test_projects/proj7_load_performance'
	} else if(projName === 'proj8') {
		ws = ws + '_custom_command'
	} else if(projName.startsWith('workspace')) {
		ws = ws + '.code-workspace'
	}

	let timeout = 15000
	if (projName === 'proj4') {
		timeout = 30000
	} else if (projName === 'DebugLines') {
		timeout = 45000
	} else if (projName.startsWith('proj7')) {
		timeout = 60000
	}


	const reporterDir = path.resolve(__dirname, '..', 'artifacts', vsVersion + '-' + oeVersion)
	fs.mkdirSync(reporterDir, { recursive: true })
	const jsonFile = path.resolve(reporterDir, 'mocha_results_' + projName + '.json')
	const mochaFile = path.resolve(reporterDir, 'mocha_results_junit_' + projName + '.xml')
	const sonarFile = path.resolve(reporterDir, 'mocha_results_sonar_' + projName + '.xml')
	const xunitFile = path.resolve(reporterDir, 'mocha_results_xunit_' + projName + '.xml')

	return {
		label: 'suite:' + projName,
		extensionDevelopmentPath: './',
		workspaceFolder: ws,
		files: './test/suites/' + projName + '.test.ts',
		version: vsVersion,
		launchArgs: args,
		mocha: {
			preload: 'ts-node/register/transpile-only',
			timeout: timeout,
			ui: 'tdd',
			retries: 0,
			reporter: 'mocha-multi-reporters',
			reporterOptions: {
				reporterEnabled: 'spec,json,xunit,mocha-junit-reporter,mocha-sonarqube-reporter',
				jsonReporterOptions: {
					output: jsonFile
				},
				xunitReporterOptions: {
					output: xunitFile
				},
				mochaJunitReporterReporterOptions: {
					mochaFile: mochaFile
				},
				mochaSonarqubeReporterReporterOptions: {
					output: sonarFile
				}
			}
		},
		env: {
			// VSCODE_VERSION: 'stable',
			ABLUNIT_TEST_RUNNER_UNIT_TESTING: 'true',
			VSCODE_SKIP_PRELAUNCH: '1'
		}
	}
}

const testConfig = defineConfig({
	tests: [
		getTestConfig('DebugLines'),
		getTestConfig('proj0'),
		getTestConfig('proj1'),
		getTestConfig('proj2'),
		getTestConfig('proj3'),
		getTestConfig('proj4'),
		getTestConfig('proj5'),
		getTestConfig('proj6'),
		getTestConfig('proj7A'),
		getTestConfig('proj7B'),
		getTestConfig('proj8'),
		getTestConfig('proj9'),
		getTestConfig('projA'),
		getTestConfig('TestProfileParser'),
		getTestConfig('workspace0'),
		getTestConfig('workspace1'),
	],
	coverage: {
		includeAll: true,
		reporter: ['lcov', 'text-summary'],
		output: './coverage/'
	}
})

export async function createTestConfig () {
	writeConfigToFile('config', testConfig)
	return testConfig
}
