import * as path from "path";

export function setupNyc(projName: string) {
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
