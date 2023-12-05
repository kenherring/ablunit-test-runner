import { workspace } from 'vscode'
import { getTestConfig } from './createTestConfig'
// eslint-disable-next-line @typescript-eslint/no-var-requires
// const { getTestConfig } = require('./out/test/createTestConfig')
import * as glob from "glob"
import * as path from "path"
import * as Mocha from "mocha"

function setupNyc(projName: string) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
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
	console.log("RETURN nyc")
	return nyc
}

function setupMocha(projName: string, timeout: number) {
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
	console.log("nyc= " + nyc)
	const mocha = setupMocha(projName, timeout)
	const testsRoot = path.resolve(__dirname, "..")
	return new Promise<void>((c, e) => {
		glob("**/extension." + projName + ".test.js", {
			cwd: testsRoot
		}, (err, files) => {
			if (err) {
				return e(err)
			}

			// Add files to the test suite
			files.forEach((f) => {
				mocha.addFile(path.resolve(testsRoot, f))
			})

			try {
				// Run the mocha test
				mocha.run(async (failures) => {
					if (nyc) {
						console.log("nyc.writeCoverageFile")
						await nyc.writeCoverageFile()
						console.log("nyc.report")
						await nyc.report()
					}

					if (failures > 0) {
						console.log(`${failures} tests failed.`)
						e(new Error(`${failures} tests failed.`))
					}
					c()
				})
			} catch (err) {
				console.error('[index.ts] catch err= ' + err)
				e(err)
			}
		})
	})
}

export function run(): Promise <void> {
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
