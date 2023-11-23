import * as glob from "glob";
import * as Mocha from "mocha";
import * as path from "path";
import { setupNyc } from "../indexCommon";

const projName = 'proj0'

export function run(): Promise <void> {
	const nyc = setupNyc(projName);

	// Create the mocha test
	const mocha = new Mocha({
		color: true,
		ui: "tdd",
		timeout: 20000,
		reporter: 'mocha-multi-reporters',
		reporterOptions: {
			reporterEnabled: 'text, spec, mocha-junit-reporter',
			mochaJunitReporterReporterOptions: {
				mochaFile: 'artifacts/mocha_results_' + projName + '.xml'
			}
		}
	})

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
