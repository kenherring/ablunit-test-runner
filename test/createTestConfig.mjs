/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// @ts-nocheck

import { defineConfig } from '@vscode/test-cli'
import { fileURLToPath } from 'url'
import * as glob from 'glob'
import * as path from 'path'
import * as fs from 'fs'
import process from 'process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const vsVersionNum = '1.88.0'
const vsVersion = process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] ?? 'stable'
const oeVersion = process.env['ABLUNIT_TEST_RUNNER_OE_VERSION'] ?? '12.8.1'
const useOEAblPrerelease = false
const enableExtensions = [
	'AtStart',
	'DebugLines',
	'proj2',
	'proj3',
	'proj4',
	'proj5',
	'proj7A',
	'proj7B',
	'proj8',
	'proj9',
]

function initialize () {
	if (vsVersion !== 'insiders' && vsVersion !== 'stable') {
		throw new Error('Invalid version: ' + vsVersion)
	}
}

function writeConfigToFile (name, config) {
	fs.writeFileSync('.vscode-test.' + name + '.bk.json', JSON.stringify(config, null, 4).replace('    ', '\t'))
}

function getMochaTimeout (projName, firstTest) {
	let timeout = 15000
	if (projName === 'examples') {
		timeout = 1000
	}

	switch (projName) {
		case 'DebugLines': timeout = 60000; break // install openedge-abl-lsp for the first time, so give it a moment to start
		case 'proj1': timeout = 30000; break
		// case 'proj2': return 20000
		case 'proj5': timeout = 60000; break
		case 'proj8': timeout = 45000; break
		case 'proj7A': timeout = 60000; break
	}

	if (firstTest) {
		timeout = 45000
	}

	return timeout
}

/**
* Additional options to pass to the Mocha runner.
* @see https://mochajs.org/api/mocha
*/
function getMochaOpts (projName, firstTest) {
	// const reporterDir = path.resolve(__dirname, '..', 'artifacts', vsVersion + '-' + oeVersion)
	const reporterDir = path.resolve(__dirname, '..', 'artifacts')
	fs.mkdirSync(path.resolve(reporterDir, 'mocha_results_json'), {recursive: true})
	fs.mkdirSync(path.resolve(reporterDir, 'mocha_results_junit'), {recursive: true})
	fs.mkdirSync(path.resolve(reporterDir, 'mocha_results_sonar'), {recursive: true})
	fs.mkdirSync(path.resolve(reporterDir, 'mocha_results_xunit'), {recursive: true})
	const jsonFile = path.resolve(reporterDir, 'mocha_results_json', projName + '.json')
	const mochaFile = path.resolve(reporterDir, 'mocha_results_junit', projName + '.xml')
	const sonarFile = path.resolve(reporterDir, 'mocha_results_sonar', projName + '.xml')
	const xunitFile = path.resolve(reporterDir, 'mocha_results_xunit', projName + '.xml')
	// const bail = process.env['CIRCLECI'] != 'true' || false

	/** @type {import('mocha').MochaOptions} */
	const mochaOpts = {
		// fullTrace: true
		timeout: getMochaTimeout(projName, firstTest),
		// ui: 'tdd', // describe, it, etc
		// ui: 'bdd' // default; suite, test, etc
		retries: 0,
		parallel: false,
		bail: false,
		require: [
			'mocha',
			'tsconfig-paths/register',
			'@swc-node/register',
		],
	}

	if (process.env['ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG']) {
		mochaOpts.reporter = 'mocha-multi-reporters'
		mochaOpts.reporterOptions = {
			reporterEnabled: [ 'json-stream', 'spec', 'json', 'xunit', 'mocha-junit-reporter', 'mocha-reporter-sonarqube' ],
			jsonReporterOptions: { output: jsonFile, outputFile: jsonFile, mochaFile: jsonFile }, // TODO - not working
			xunitReporterOptions: { output: xunitFile },
			mochaJunitReporterReporterOptions: { mochaFile: mochaFile },
			mochaReporterSonarqubeReporterOptions: { filename: sonarFile },
		}
	}

	if (process.env['CIRCLECI']) {
		mochaOpts.bail = false
	}

	return mochaOpts
}

function getLaunchArgs (projName) {
	const args = []
	// const extVersion = getExtensionVersion()

	// --- start in directory --- //
	// 'test_projects/' + projName, // workspaceFolder is set in the config

	// --- args defined by `code -h` --- //
	// args.push('--add', '<folder>')
	// args.push('--goto', '<file:line[:character]>')
	// args.push('--new-window')
	// args.push('--reuse-window')
	// args.push('--wait')
	// args.push('--locale <locale>')
	// args.push('--user-data-dir', '<dir>')
	// args.push('--profile <profileName>')
	// args.push('--profile-temp') // create a temporary profile for the test run in lieu of cleaning up user data
	// args.push('--help')
	// args.push('--extensions-dir', '<dir>')
	// args.push('--list-extensions')
	// args.push('--show-versions')
	// args.push('--category', '<category>')
	// args.push('--install-extension <ext-id>')

	// if (vsVersion === 'insiders') {
	// 	args.push('--install-extension', '../ablunit-test-runner-' + extVersion + '.vsix')
	// } else {
	// 	args.push('--install-extension', './ablunit-test-runner-insiders-' + extVersion + '.vsix')
	// }
	if (enableExtensions.includes(projName)) {
		if (useOEAblPrerelease) {
			args.push('--install-extension', 'riversidesoftware.openedge-abl-lsp@prerelease')
		} else {
			args.push('--install-extension', 'riversidesoftware.openedge-abl-lsp')
		}
	}
	// args.push('--pre-release')
	// args.push('--uninstall-extension <ext-id>')
	// args.push('--update-extensions')
	// if (vsVersion === 'insiders') {
	// 	args.push('--enable-proposed-api', 'TestCoverage') // '<ext-id>'
	// }
	// if (vsVersion === 'insiders') {
	// 	args.push('--enable-proposed-api', 'kherring.ablunit-test-runner')
	// }
	// args.push('--version')
	// args.push('--verbose')
	// args.push('--trace')
	// args.push('--log', '<level>')
	if (process.env['VERBOSE'] == 'true') {
		args.push('--log', 'debug')
		// args.push('--log', 'trace')
	}
	// args.push('--log', 'debug') // '<level>'
	// args.push('--log', 'trace') // '<level>'
	// args.push('--log', 'kenherring.ablunit-test-runner:debug') // <extension-id>:<level>
	// args.push('--log', 'kenherring.ablunit-test-runner:trace') // <extension-id>:<level>
	// args.push('--logsPath', './artifacts/vscode_logs/') // undocumented
	// args.push('--status')
	// args.push('--prof-startup')
	// args.push('--disable-extension <ext-id>')
	if (!enableExtensions.includes(projName)) {
		args.push('--disable-extensions')
		args.push('--disable-extension', 'riversidesoftware.openedge-abl-lsp')
	}
	args.push('--disable-extension', 'vscode.builtin-notebook-renderers')
	args.push('--disable-extension', 'vscode.emmet')
	args.push('--disable-extension', 'vscode.git')
	args.push('--disable-extension', 'vscode.github')
	args.push('--disable-extension', 'vscode.grunt')
	args.push('--disable-extension', 'vscode.gulp')
	args.push('--disable-extension', 'vscode.jake')
	args.push('--disable-extension', 'vscode.ipynb')
	args.push('--disable-extension', 'vscode.tunnel-forwarding')
	args.push('--sync', 'off') // '<on | off>'
	// args.push('--inspect-extensions', '<port>')
	// args.push('--inspect-brk-extensions', '<port>')
	// args.push('--logExtensionHostCommunication')

	// --- disable functionality not needed for testing - https://github.com/microsoft/vscode/issues/174744 --- //
	// args.push('--disable-chromium-sandbox')
	// args.push('--no-sandbox', '--sandbox=false')  ## super user only
	args.push('--disable-crash-reporter')
	args.push('--disable-gpu-sandbox')
	args.push('--disable-gpu')
	args.push('--disable-telemetry')
	args.push('--disable-updates')
	args.push('--disable-workspace-trust')
	// Warning: 'xshm' is not in the list of known options, but still passed to Electron/Chromium.
	args.push('--disable-dev-shm-usage', '--no-xshm')
	return args
}

function getTestConfig (projName, firstTest) {

	let workspaceFolder = '' + projName
	if (projName.startsWith('proj7')) {
		workspaceFolder = 'proj7_load_performance'
	} else if (projName.startsWith('workspace')) {
		workspaceFolder = projName + '.code-workspace'
	}
	workspaceFolder = path.resolve(__dirname, '..', 'test_projects', workspaceFolder)

	if (!fs.existsSync(workspaceFolder)) {
		const g = glob.globSync('test_projects/' + projName + '_*')
		if (g.length > 1) {
			throw new Error('Multiple workspaces found: ' + workspaceFolder)
		}
		if (!g[0]) {
			throw new Error('No workspace found: ' + workspaceFolder)
		}
		workspaceFolder = g[0]
	}

	let useInstallation
	if (fs.existsSync('.vscode-test/vscode-win32-x64-archive-' + vsVersionNum + '/Code.exe')) {
		useInstallation = { fromPath: '.vscode-test/vscode-win32-x64-archive-' + vsVersionNum + '/Code.exe' }
	}

	const absolulteFile = path.resolve(__dirname, '..', 'test', 'suites', projName + '.test.ts')

	const env = {
		ABLUNIT_TEST_RUNNER_ENABLE_EXTENSIONS: enableExtensions.includes('' + projName),
		ABLUNIT_TEST_RUNNER_UNIT_TESTING: true,
		ABLUNIT_TEST_RUNNER_VSCODE_VERSION: vsVersion,
		DONT_PROMPT_WSL_INSTAL: true,
		// VSCODE_SKIP_PRELAUNCH: true,
	}

	let installExtensions
	if (enableExtensions.includes(projName)) {
		installExtensions = ['riversidesoftware.openedge-abl-lsp']
	}

	process.env['ABLUNIT_TEST_RUNNER_ENABLE_EXTENSIONS'] = enableExtensions.includes('' + projName)
	process.env['ABLUNIT_TEST_RUNNER_UNIT_TESTING'] = 'true'
	process.env['DONT_PROMPT_WSL_INSTALL'] = 'true'
	process.env['VSCODE_SKIP_PRELAUNCH'] = 'true'

	return {
		//  -- IDesktopPlatform -- //
		// platform: 'desktop',
		// desktopPlatform: 'win32',
		launchArgs: getLaunchArgs(projName),
		env,
		useInstallation,
		// useInstallation: { fromMachine: true },
		// installExtension: 'riversidesoftware.openedge-abl-lsp',
		installExtensions,
		// download: { reporter: ProgressReporter, timeout: ? }
		// skipExtensionDependencies: true,

		// --- IBaseTestConfiguration --- //
		files: absolulteFile,
		version: vsVersion,
		extensionDevelopmentPath: path.resolve(__dirname, '..'),
		extensionTestsPath: path.resolve(__dirname, '..', 'test'),
		workspaceFolder,
		mocha: getMochaOpts(projName, firstTest),
		label: 'suite_' + projName,
		srcDir: './',
	}
	return testConfig
}

function getTests () {
	const tests = []
	const envProjectName = process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME'] ?? undefined

	// --- run only the specified projects --- //
	if (envProjectName && envProjectName != '') {
		const projects = envProjectName.split(',')
		for (const p of projects) {
			tests.push(getTestConfig(p, tests.length == 0))
		}
		return tests
	}

	// --- run all projects --- //
	const g = glob.globSync('test/suites/*.test.ts').reverse()
	for (const f of g) {
		const basename = path.basename(f, '.test.ts')
		if (basename != 'proj2' &&
			basename != 'proj3' &&
			basename != 'proj4' &&
			basename != 'proj7B' &&
			basename != 'proj9'
		) {
			tests.push(getTestConfig(basename, tests.length == 0))
		}
	}
	return tests
}

function getCoverageOpts () {
	const coverageDir = path.resolve(__dirname, '..', 'artifacts', 'coverage')
	fs.mkdirSync(coverageDir, { recursive: true })
	return {
		exclude: [
			'dist',
			'.vscode-test.mjs',
			'test_projects',
			'dummy-ext',
			'webpack.config.js',
			'vscode.proposed.*.d.ts',
			'vscode',
		],
		include: [
			// '**/*',
			'**/src/**',
			'**/test/**',
		],
		// https://istanbul.js.org/docs/advanced/alternative-reporters/
		// * default = ['html'], but somehow also prints the 'text-summary' to the console
		// * 'lcov' includes 'html' output
		reporter: [ 'text', 'lcov' ],
		// includeAll: true,
		output: coverageDir,

		// TODO - not reporting extension, or other files loaded w/ vscode extension activate

		// ----- NOT REAL OPTIONS?? ----- //
		require: [ 'ts-node/register' ],
		// cache: false,
		// 'enable-source-maps': true,
		// sourceMap: false,
		// instrument: false,
	}
	return coverageOpts
}

export function createTestConfig () { // NOSONAR
	initialize()

	const testConfig = {
		tests: getTests(),
		coverage: getCoverageOpts(),
	}

	const definedConfig = defineConfig(testConfig)
	writeConfigToFile('testConfig', testConfig)
	writeConfigToFile('defined', definedConfig)
	return definedConfig
}
