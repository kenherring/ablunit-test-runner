import * as glob from "glob";
import * as Mocha from "mocha";
import * as path from "path";

const projName = 'proj0'

function setupNyc() {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const NYC = require("nyc");
	const nyc = new NYC({
		cache: false,
		cwd: path.join(__dirname, "..", "..", ".."),
		reportDir: path.join(__dirname, "..", "..", "..", 'coverage', "coverage_" + projName),
		tempDir: path.join(__dirname, "..", "..", "..", 'coverage', "coverage_" + projName, ".nyc_output"),
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
	nyc.reset();
	nyc.wrap();
	return nyc;
}

export function run(): Promise <void> {
	const nyc = setupNyc();

	// Create the mocha test
	const mocha = new Mocha({
		color: true,
		ui: "tdd",
		timeout: 20000,
		reporter: 'mocha-junit-reporter',
		reporterOptions: {
			mochaFile: 'artifacts/mocha_results_' + projName + '.xml'
		}
	});

	const testsRoot = path.resolve(__dirname, "..");
	return new Promise((c, e) => {
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
						throw new Error(`${failures} tests failed.`);
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
