/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { GlobSync } from 'glob'
import { workspace } from 'vscode'
import Mocha from 'mocha'
import * as path from 'path'
import * as fs from 'fs'
import { ITestConfig } from './createTestConfig.js'

function setupNyc (projName: string) {
	const NYC = require('nyc')

	const currentWorkingDir = path.join(__dirname, "..", "..")
	const reportDir = path.join(__dirname, "..", "..", 'coverage', "coverage_" + projName)
	const tempDir = path.join(__dirname, "..", "..", 'coverage', "coverage_" + projName, ".nyc_output")
	console.log(
		"[setupNyc]",
		", currentWorkingDir=" + currentWorkingDir,
		", reportDir=" + reportDir,
		", tempDir=" + tempDir)

	const nyc = new NYC({
		cache: false,
		cwd: currentWorkingDir,
		reportDir: reportDir,
		tempDir: tempDir,
		sourceMap: true,
		extension: [
			".ts",
			".tsx",
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
	// 	console.debug('Invalidate require cache for ' + m)
	// 	delete require.cache[m]
	// 	require(m)
	// })
	return nyc
}

function setupMocha (projName: string, timeout: number) {
	return new Mocha({
		color: true,
		ui: "tdd",
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

async function runTestsForProject (projName: string, timeout: number) {
	console.log('[runTestsForProject] projName=' + projName)
	const nyc = setupNyc(projName)
	const mocha = setupMocha(projName, timeout)
	const testsRoot = path.resolve(__dirname, "..")

	console.log('[runTestsForProject] testsRoot=' + testsRoot)
	const files = new GlobSync('**/' + projName + '.test.js', { cwd: testsRoot })
	console.log('[runTestsForProject] pattern=**/' + projName + '.test.js, file.found.length=' + files.found.length)
	for(const f of files.found) {
		console.log('[runTestsForProject] mocha.addFile ' + path.resolve(testsRoot, f))
		mocha.addFile(path.resolve(testsRoot, f))
	}

	const prom = new Promise<void>((c, e) => {
		try {
			// Run the mocha test
			mocha.run((failures) => {
				if (failures > 0) {
					console.log('[runTestsForProject] ' + failures + ' tests failed.')
					e(new Error(failures + ' tests failed.'))
				}
				c()
			})
		} catch (err) {
			console.error('[runTestsForProject]  catch err= ' + err)
			if (err instanceof Error) {
				e(err)
			}
			e(new Error("non error type:" + err + ", typeof=" + typeof err))
		}
	})

	await prom

	console.log('[runTestsForProject] outputting coverage...')
	nyc.writeCoverageFile()
	await nyc.report().then(() => {
		console.log('[runTestsForProject] nyc.report() successful')
	}, (err: Error) => {
		console.error('[runTestsForProject] nyc.report() err=' + err)
		// e(err)
	})
	console.log('[runTestsForProject] coverage outputted successfully!')
}

function findConfigFile () {
	// search up to 5 levels back for .vscode-test.config.json
	let configFilename: string = './.vscode-test.config.json'
	for (let i = 0; i < 5; i++) {
		if (fs.existsSync(configFilename)) {
			return configFilename
		}
		configFilename = '../' + configFilename
	}
	throw new Error('[findConfigFile] Could not find .vscode-test.config.json')
}

export function run (): Promise <void> {

	let proj: string
	if (process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME']) {
		proj = process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME']
	} else if (workspace.workspaceFile) {
		proj = workspace.workspaceFile.fsPath
	} else if (workspace.workspaceFolders) {
		proj = workspace.workspaceFolders[0].uri.fsPath
	} else {
		throw new Error('[run] No workspace file or folder found')
	}

	proj = proj.replace(/\\/g, '/').split('/').reverse()[0].replace('.code-workspace', '')
	proj = proj.split('_')[0]

	const configFilename = findConfigFile()
	const testConfig: ITestConfig[] = JSON.parse(fs.readFileSync(configFilename, 'utf8'))
	const config = testConfig.filter((config: ITestConfig) => { return config.projName === proj })[0]
	if (!config) {
		throw new Error('[run] Could not find config for project ' + proj)
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
	return runTestsForProject(proj, config.mocha.timeout)
}
