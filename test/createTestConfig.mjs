/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-console */
// @ts-nocheck

import { defineConfig } from '@vscode/test-cli'
import { fileURLToPath } from 'url'
import * as glob from 'glob'
import * as path from 'path'
import * as fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let vsVersion = process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] ?? 'stable'
let oeVersion = process.env['ABLUNIT_TEST_RUNNER_OE_VERSION'] ?? '12.2.12'
const enableExtensions = [
	'DebugLines',
	'proj2',
	'proj3',
	'proj4',
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
	fs.writeFileSync('.vscode-test.' + name + '.json.bk', JSON.stringify(config, null, 4).replace('    ', '\t'))
}

function getMochaTimeout (projName) {
	if (projName === 'proj3' && projName === 'proj4') {
		return 30000
	}
	if (projName === 'proj1') {
		return 45000
	}
	if (projName === 'DebugLines') {
		return 60000
	}
	if (projName.startsWith('proj7')) {
		// return 60000
		return 90000
	}
	// return 15000
	return 25000
}

function getMochaOpts (projName) {
	const reporterDir = path.resolve(__dirname, '..', 'artifacts', vsVersion + '-' + oeVersion)
	fs.mkdirSync(reporterDir, { recursive: true })
	const jsonFile = path.resolve(reporterDir, 'mocha_results_' + projName + '.json')
	const mochaFile = path.resolve(reporterDir, 'mocha_results_junit_' + projName + '.xml')
	const sonarFile = path.resolve(reporterDir, 'mocha_results_sonar_' + projName + '.xml')
	const xunitFile = path.resolve(reporterDir, 'mocha_results_xunit_' + projName + '.xml')

	const mochaOpts = {
		preload: [
			// './dist/extension.js',
			'ts-node/register/transpile-only',
			'ts-node/register',
			// 'source-map-support',
			// 'source-map-support/register',
			// 'source-map-support/register-hook-require',
		],
		// preload: [ 'ts-node/register/transpile-only' ],
		timeout: getMochaTimeout(projName),
		ui: 'tdd',
		parallel: false,
		retries: 0,
		recursive: true,
		color: true,
		exit: true,
		extension: [ 'js', 'ts', 'test.ts' ],
		require: [
			// './dist/extension.js',
			// 'source-map-support',
			'source-map-support/register',
			// 'source-map-support/register-hook-require',
			// 'ts-node/register',
		]
	}

	// TODO - prevents results from reporting to vscode-extension-test-runner
	mochaOpts.reporter = 'mocha-multi-reporters'
	mochaOpts.reporterOptions = {
		reporterEnabled: [ 'spec', 'mocha-junit-reporter', 'mocha-sonarqube-reporter' ],
		// reporterEnabled: [ 'spec', 'mocha-junit-reporter', 'mocha-sonarqube-reporter', 'fullJsonStreamReporter', 'xunit', 'json' ],
		jsonReporterOptions: { output: jsonFile },
		xunitReporterOptions: { output: xunitFile },
		mochaJunitReporterReporterOptions: { mochaFile: mochaFile },
		mochaSonarqubeReporterReporterOptions: { output: sonarFile }
	}
	return mochaOpts
}

function getLaunchArgs (projName) {
	const args = [
		// 'test_projects/' + projName, // workspaceFolder is set in the config
		'--disable-gpu',
		// '--reuse-window',
		// '--user-data-dir=./test_projects/' + projName + '/.vscode-data/',
		// '--profile=' + projName,
		// '--sync=off',
		// '--telemetry',
		'--log=debug',
		// '--log=trace',
		// '--verbose',
	]
	// if (enableExtensions.includes(projName)) {
	// 	'--install-extension=riversidesoftware.openedge-abl-lsp'
	// }
	if (!enableExtensions.includes(projName)) {
		args.push('--disable-extensions')
	}
	if (vsVersion === 'insiders') {
		args.push('--enable-proposed-api=TestCoverage')
	}
	// args.push('--enable-source-maps')
	// args.push('--produce-source-map')
	return args
}

function getTestConfig (projName) {

	let ws = './test_projects/' + projName
	if (projName.startsWith('proj7')) {
		ws = './test_projects/proj7'
	} else if (!fs.existsSync(ws)) {
		const g = glob.globSync(ws + '_*')
		if (g.length > 1) {
			throw new Error('Multiple workspaces found: ' + ws)
		} else {
			ws = g[0] ?? './test_projects'
		}
	}

	let useInstallation
	if (fs.existsSync('.vscode-test/vscode-win32-x64-archive-1.86.2/Code.exe')) {
		useInstallation = { fromPath: '.vscode-test/vscode-win32-x64-archive-1.86.2/Code.exe' }
	}

	return {
		label: 'suite:' + projName,
		extensionDevelopmentPath: './',
		workspaceFolder: ws,
		files: './test/suites/' + projName + '.test.ts',
		version: vsVersion,
		// useInstallation: { fromMachine: true },
		// TODO - glob?
		useInstallation: useInstallation,
		launchArgs: getLaunchArgs(projName),
		mocha: getMochaOpts(projName),
		srcDir: './',
		env: {
			ABLUNIT_TEST_RUNNER_ENABLE_EXTENSIONS: enableExtensions.includes('' + projName),
			ABLUNIT_TEST_RUNNER_UNIT_TESTING: 'true',
			ABLUNIT_TEST_RUNNER_VSCODE_VERSION: vsVersion,
			VSCODE_SKIP_PRELAUNCH: '1',
			// NODE_OPTIONS: [
			// 	'--enable-source-maps',
			// 	'--require source-map-support/register',
			// 	// 	// '--produce-source-map',
			// ],
			// NODE_OPTIONS: '--produce-source-map',
		}
	}
}

function getTests () {
	let tests = []
	if (process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME']) {
		const projects = process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME'].split(',')
		for (const p of projects) {
			tests.push(getTestConfig(p))
		}
	} else {
		const g = glob.globSync('test/suites/*.test.ts').reverse()
		for (const f of g) {
			tests.push(getTestConfig(path.basename(f, '.test.ts')))
		}
	}
	return tests
}

function getCoverageOpts () {
	const coverageDir = path.resolve(__dirname, '..', 'coverage', vsVersion + '-' + oeVersion)
	fs.mkdirSync(coverageDir, { recursive: true })
	return {
		reporter: [ 'text', 'lcov' ],
		output: coverageDir,
		// includeAll: true,
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
		require: [ 'ts-node/register' ],
		// cache: false,
		// 'enable-source-maps': true,
		// sourceMap: false,
		// instrument: false,
	}
}

export async function createTestConfig () { // NOSONAR
	initialize()
	const testConfig = defineConfig({
		tests: getTests(),
		coverage: getCoverageOpts(),
	})

	writeConfigToFile('config', testConfig)
	return testConfig
}
