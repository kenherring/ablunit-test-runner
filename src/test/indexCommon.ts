import * as glob from "glob"
import * as path from "path"
import * as Mocha from "mocha"

export function setupNyc(projName: string) {
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
	});
	nyc.reset()
	nyc.wrap()
	return nyc
}

export function setupMocha(projName: string, timeout: number = 20000) {
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

export function runTests (projName: string, timeout?: number) {

	const nyc = setupNyc(projName)
	const mocha = setupMocha(projName, timeout)
	const testsRoot = path.resolve(__dirname, "..");
	return new Promise<void>((c, e) => {
		glob("**/**." + projName + ".test.js", {
			cwd: testsRoot
		}, (err, files) => {
			if (err) {
				return e(err);
			}

			// Add files to the test suite
			files.forEach((f) => {
				mocha.addFile(path.resolve(testsRoot, f))
			});

			try {
				// Run the mocha test
				mocha.run(async (failures) => {
					if (nyc) {
						nyc.writeCoverageFile();
						await nyc.report();
					}

					if (failures > 0) {
						console.log(`${failures} tests failed.`)
						e(new Error(`${failures} tests failed.`))
					}
					c();
				});
			} catch (err) {
				console.error('[index_' + projName + '.ts] catch err= ' + err);
				e(err);
			}
		});
	});
}
