/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { GlobSync }  from 'glob'
import * as path from 'path'
import * as Mocha from 'mocha'

function setupNyc(projName: string) {
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

function setupMocha(projName: string) {
	return new Mocha({
		color: true,
		ui: "tdd",
		timeout: 10000,
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

function runTests (projName: string) {
	const nyc = setupNyc(projName)
	const mocha = setupMocha(projName)
	const testsRoot = path.resolve(__dirname, "..")

	console.log("100")
	return new Promise<void>((c, e) => {
		console.log("101")
		const files = new GlobSync("**/*Parser.test.js", { cwd: testsRoot })
		console.log("102 - " + files.found.length + " test files found")

		for(const f of files.found) {
			console.log("mocha.addFile " + path.resolve(testsRoot, f))
			mocha.addFile(path.resolve(testsRoot, f))
		}
		console.log("103")

		try {
			console.log("104")
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
console.log("112")

export function run(): Promise <void> {
	console.log("200")
	const ret = runTests('parsers')
	console.log("201")
	return ret
}
