/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { vscodeVersion } from '../ABLUnitCommon'
import Mocha from 'mocha'
import * as path from 'path'

const file = 'runTest.ts'

export function setupNyc (version: vscodeVersion, projName: string) {
	const NYC = require('nyc')

	const currentWorkingDir = path.join(__dirname, '..', '..')
	const oeVersion = process.env['ABLUNIT_TEST_RUNNER_OE_VERSION'] ?? '0.0.0'
	// const tempDir = path.join(__dirname, '..', '..', 'coverage', '.nyc_output')
	const tempDir = path.join(__dirname, '..', '..', 'coverage', '.nyc_output', version + '-' + oeVersion + '-' + projName)
	const reportDir = path.join(__dirname, '..', '..', 'coverage', 'coverage_' + version + '-' + oeVersion + '-' + projName)
	console.log('[' + file + ' setupNyc] currentWorkingDir=' + currentWorkingDir + ', reportDir=' + reportDir + ', tempDir=' + tempDir)

	const nyc = new NYC({
		cache: false,
		cwd: currentWorkingDir,
		reportDir: reportDir,
		tempDir: tempDir,
		sourceMap: true,
		extension: [
			'.ts',
			'.tsx',
		],
		reporter: [
			'text',
			'lcov'
		],
		// require: [
		// 	// "ts-node/register",
		// 	// "source-map-support/register"
		// ],
		esModules: true,
		excludeNodeModules: true,
		excludeAfterRemap: true,
		exclude: [
			'.vscode-test',
			'dummy-ext',
		],
		hookRequire: true,

		// not neeed
		instrument: false
	})

	nyc.reset()
	nyc.wrap()

	// log.warn('Invalidating require cache...')
	// Object.keys(require.cache).filter(f => nyc.exclude.shouldInstrument(f)).forEach(m => {
	// 	console.debug('[' + file + '] Invalidate require cache for ' + m)
	// 	delete require.cache[m]
	// 	require(m)
	// })
	return nyc
}

export function setupMocha (version: vscodeVersion, projName: string, basedir: string, timeout: string | number | undefined) {
	const oeVersion = process.env['ABLUNIT_TEST_RUNNER_OE_VERSION'] ?? '0.0.0'
	return new Mocha({
		color: true,
		ui: 'tdd',
		timeout: timeout,
		reporter: 'mocha-multi-reporters',
		reporterOptions: {
			reporterEnabled: 'spec, mocha-junit-reporter, mocha-reporter-sonarqube',
			mochaJunitReporterReporterOptions: {
				mochaFile: basedir + '/artifacts/' + version + '-' + oeVersion + '/mocha_results_junit_' + projName + '.xml'
			},
			mochaReporterSonarqubeReporterOptions: {
				filename: basedir + '/artifacts/' + version + '-' + oeVersion + '/mocha_results_sonar_' + projName + '.xml'
			}
		}
	})
}
