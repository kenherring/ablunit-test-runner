import * as glob from "glob";
import * as Mocha from "mocha";
import * as path from "path";

function setupNyc() {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const NYC = require("nyc");
	// create an nyc instance, config here is the same as your package.json
	const nyc = new NYC({
		cache: false,
		cwd: path.join(__dirname, "..", "..", ".."),
		reportDir: path.join(__dirname, "..", "..", "..", "coverage"),
		tempDir: path.join(__dirname, "..", "..", "..", "coverage", ".nyc_output"),
		exclude: [
			".attic",
			".history",
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
		reporter: ["html", "text"],
		require: [
			"ts-node/register",
		],
		sourceMap: true,
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
		timeout: 5000
	});

	const testsRoot = path.resolve(__dirname, "..");
	return new Promise((c, e) => {
		glob("**/**.proj3.test.js", {
			cwd: testsRoot
		}, (err, files) => {
			if (err) {
				return e(err);
			}

			// Add files to the test suite
			files.forEach((f) => {
				console.log("f=" + f)
				mocha.addFile(path.resolve(testsRoot, f))
			});



			try {
				console.log("1")
				// Run the mocha test
				mocha.run(async (failures) => {
					console.log("2")
					if (nyc) {
						console.log("3")
						nyc.writeCoverageFile();
						console.log("4")
						await nyc.report();
						console.log("5")
					}
					console.log("6")

					if (failures > 0) {
						console.log("7")
						e(new Error(`${failures} tests failed.`));
						console.log("8")
					}
					console.log("9")
					c();
					console.log("10")
				});
				console.log("11")
			} catch (err) {
				console.log("12")
				console.error(err);
				console.log("13")
				e(err);
				console.log("14")
			}
			console.log("15")
		});
		console.log("16")
	});

}
