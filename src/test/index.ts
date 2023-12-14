/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { getTestConfig } from './createTestConfig'
import { GlobSync }  from 'glob'
import { workspace } from 'vscode'
import Mocha = require("mocha");
import * as path from 'path'

function setupNyc (projName: string) {
	const NYC = require("nyc")
	const nyc = new NYC({
		cache: false,
		cwd: path.join(__dirname, "..", ".."),
		reportDir: path.join(__dirname, "..", "..", 'coverage', "coverage_" + projName),
		tempDir: path.join(__dirname, "..", "..", 'coverage', "coverage_" + projName, ".nyc_output"),
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
	return nyc
}

function setupMocha (projName: string, timeout: number) {
	return new Mocha({
		color: true,
		ui: "tdd",
		timeout: timeout,
		// reporter: 'mocha-junit-reporter',
		// reporterOptions: {
		// 	mochaFile: 'artifacts/mocha_results_' + projName + '.xml'
		// }
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
	const nyc = setupNyc(projName)
	const mocha = setupMocha(projName, timeout)
	const testsRoot = path.resolve(__dirname, "..")
	return new Promise<void>((c, e) => {
		const files = new GlobSync("**/*" + projName + ".test.js", { cwd: testsRoot })

		for(const f of files.found) {
			console.log("mocha.addFile " + path.resolve(testsRoot, f))
			mocha.addFile(path.resolve(testsRoot, f))
		}

		try {
			// Run the mocha test
			mocha.run((failures) => {
				console.log("nyc.writeCoverageFile()")
				if (failures > 0) {
					console.log("106")
					console.log(`${failures} tests failed.`)
					console.log("107")
					e(new Error(`${failures} tests failed.`))
				}
				if (nyc) {
					nyc.writeCoverageFile()
					console.log("nyc.writeCoverageFile() done")
					nyc.report().then(() => {
						console.log("nyc.report() done")
						c()
					})
				}
				console.log("105 failures=" + failures)
			}).on('end', () => {
				console.log("106 - END")
			})
			console.log("109")

		} catch (err) {
			console.error('[index_2.ts] catch err= ' + err)
			e(err)
		}
		console.log("110")
	})
	console.log("111")
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
