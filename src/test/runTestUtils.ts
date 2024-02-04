/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import Mocha from 'mocha'
import * as path from 'path'

const file = 'runTest.ts'

export function createLaunchArgs (version: 'stable' | 'insiders', projName: string, projDir: string) {
	const launchArgs: string[] = [projDir]
	launchArgs.push('--log=debug')
	// launchArgs.push('--disable-gpu')
	// launchArgs.push('--trace-deprecation')
	if (version === 'insiders') {
		launchArgs.push('--enable-proposed-api=kherring.ablunit-test-runner')
	}
	if (projName != 'DebugLines' &&
		projName != 'proj3' &&
		projName != 'proj4' &&
		projName != 'proj7A' &&
		projName != 'proj7B' &&
		projName != 'proj9' &&
		projName != 'projA') {
		launchArgs.push('--disable-extensions')
	}
	return launchArgs
}

export function setupNyc (projName: string) {
	const NYC = require('nyc')

	const currentWorkingDir = path.join(__dirname, '..', '..')
	const reportDir = path.join(__dirname, '..', '..', 'coverage', 'coverage_' + projName)
	const tempDir = path.join(__dirname, '..', '..', 'coverage', 'coverage_' + projName, '.nyc_output')
	console.log('[' + file + '] currentWorkingDir=' + currentWorkingDir + ', reportDir=' + reportDir + ', tempDir=' + tempDir)

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

export function setupMocha (projName: string, timeout: number) {
	return new Mocha({
		color: true,
		ui: 'tdd',
		timeout: timeout,
		reporter: 'mocha-multi-reporters',
		reporterOptions: {
			reporterEnabled: 'spec, mocha-junit-reporter',
			mochaJunitReporterReporterOptions: {
				mochaFile: 'artifacts/mocha_results_' + projName + '.xml'
			}
		}
	})
}
