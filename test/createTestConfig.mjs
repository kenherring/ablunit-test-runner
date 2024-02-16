/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import { defineConfig } from '@vscode/test-cli'
// import("@vscode/test-cli").TestConfiguration

import fs from 'fs'
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
let version = 'stable'
if (process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION']) {
	version = process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION']
}
if (version !== 'insiders' && version !== 'stable') {
	throw new Error('Invalid version: ' + version)
}


function writeConfigToFile (name, config) {
	fs.writeFileSync('.vscode-test.' + name + '.json.bk', JSON.stringify(config, null, 4).replace('    ', '\t'))
}

// eslint-disable-next-line @typescript-eslint/require-await
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
	}

	let timeout = 15000
	if (projName === 'DebugLines') {
		timeout = 30000
	} else if (projName === 'proj7A') {
		timeout = 60000
	}

	return {
		label: 'suite:' + projName,
		extensionDevelopmentPath: './',
		workspaceFolder: ws,
		files: './test/suites/' + projName + '.test.ts',
		version: version,
		launchArgs: args,
		mocha: {
			preload: 'ts-node/register/transpile-only',
			timeout: timeout,
			ui: 'tdd',
			retries: 0,
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
		// getTestConfig('proj7B'),
		getTestConfig('proj8'),
		getTestConfig('proj9'),
		getTestConfig('TestProfileParser'),
		getTestConfig('workspace0.code-workspace'),
		getTestConfig('workspace1.code-workspace'),
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

// const hardcodedConfig = new IDesktopTestConfiguration({
// })

// // function writeConfigToFile (name, config) {
// // 	fs.writeFileSync('.vscode-test.' + name + '.json.bk', JSON.stringify(config, null, 4).replace('    ', '\t'))
// // }


// // let version = 'stable'
// // if (process.argv.includes('--insiders')) {
// //     version = 'insiders'
// // }

// import { fileURLToPath } from 'url'
// const __filename = fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename)
// const extensionDevelopmentPath = path.resolve(__dirname)
// // const workspaceFolder = path.join(extensionDevelopmentPath, 'test_projects')

// const hardcodedConfig = [
// 	{
// 		'files': './test/suites/proj0.test.ts',
// 		'workspaceFolder': './test_projects/proj0',
// 		'launchArgs': [
// 			path.join(extensionDevelopmentPath, 'test_projects', 'proj0'),
// 			'--disable-gpu',
// 			// "--log=debug",
// 			// "--log=verbose",
// 			'--disable-extensions',
// 		],
// 		'mocha': {
// 			'preload': 'ts-node/register/transpile-only',
// 			'ui': 'tdd',
// 			// "retries": 0,
// 		},
// 		'env': {
// 			'VSCODE_VERSION': 'stable',
// 			'ABLUNIT_TEST_RUNNER_UNIT_TESTING': 'true'
// 		},
// 	},
// 	{
// 		'files': './test/suites/proj1.test.ts',
// 		'workspaceFolder': './test_projects/proj1',
// 		'launchArgs': [
// 			path.join(extensionDevelopmentPath, 'test_projects', 'proj1'),
// 			'--disable-gpu',
// 			// "--log=debug",
// 			// "--log=verbose",
// 			'--disable-extensions',
// 		],
// 		'mocha': {
// 			'preload': 'ts-node/register/transpile-only',
// 			'ui': 'tdd',
// 			// "retries": 0,
// 		},
// 		'env': {
// 			'VSCODE_VERSION': 'stable',
// 			'ABLUNIT_TEST_RUNNER_UNIT_TESTING': 'true'
// 		},
// 	}
// ]
