/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { getTestConfig } from './createTestConfig'
import { GlobSync } from 'glob'
import { workspace } from 'vscode'
import Mocha from 'mocha'
import * as path from 'path'
const NYC = require('nyc')

function setupNyc (projName: string) {
	const nyc = new NYC({
		cache: false,
		cwd:       path.join(__dirname, "..", ".."),
		reportDir: path.join(__dirname, "..", "..", 'coverage', "coverage_" + projName),
		tempDir:   path.join(__dirname, "..", "..", 'coverage', "coverage_" + projName, ".nyc_output"),
		exclude: [
			"node_modules",
			"out/test/**",
			".vscode-test",
		],
		extension: [
			".ts",
			".tsx",
		],
		hookRequire: true,
		hookRunInContext: true,
		hookRunInThisContext: true,
		instrument: true,
		sourceMap: true,
		reporter: [
			'text',
			'lcov'
		],
		require: [
			"ts-node/register",
		]
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

function runTestsForProject (projName: string, timeout: number) {
	console.log('[runTestsForProject] projName=' + projName)
	const nyc = setupNyc(projName)
	const mocha = setupMocha(projName, timeout)
	const testsRoot = path.resolve(__dirname, "..")
	return new Promise<void>((c, e) => {
		const files = new GlobSync("**/" + projName + ".test.js", { cwd: testsRoot })
		console.log("pattern=" + "**/" + projName + ".test.js, file.found.length=" + files.found.length)
		for(const f of files.found) {
			console.log("mocha.addFile " + path.resolve(testsRoot, f))
			mocha.addFile(path.resolve(testsRoot, f))
		}

		try {
			// Run the mocha test
			mocha.run((failures) => {
				if (failures > 0) {
					console.log(`${failures} tests failed.`)
					e(new Error(`${failures} tests failed.`))
				}
				if (nyc) {
					console.log("nyc.writeCoverageFile()")
					nyc.writeCoverageFile()
					nyc.report().then(() => {
						console.log("nyc.report() done")
						c()
					})
				}
			}).on('end', () => {
				console.log("mocha.run().on('end')")
			})

		} catch (err) {
			console.error('[index_2.ts] catch err= ' + err)
			e(err)
		}
	})
}

export function run (): Promise <void> {

	let proj: string
	if (workspace.workspaceFile) {
		proj = workspace.workspaceFile.fsPath
	} else if (workspace.workspaceFolders) {
		proj = workspace.workspaceFolders[0].uri.fsPath
	} else {
		throw new Error("No workspace file or folder found")
	}

	proj = proj.replace(/\\/g, '/').split('/').reverse()[0].replace(".code-workspace", '')
	proj = proj.split('_')[0]
	const tc = getTestConfig()
	const config = tc.filter((config) => { return config.projName === proj })[0]

	return runTestsForProject(proj, config.mocha.timeout)
}
