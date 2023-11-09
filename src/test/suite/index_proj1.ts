import * as Mocha from "mocha";
import * as path from 'path';
import * as glob from 'glob';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const NYC = require('nyc');

function setupCoverage() {
	const nyc = new NYC({
		cwd: path.join(__dirname, '..', '..', '..'),
		// exclude: ['**/test/**', '.vscode-test/**'],
		// exclude: ['**/.vscode-test/**'],
		// reporter: ['text', 'html', 'lcov'],
		reporter: ['text', 'lcov'],
		// reporter: ['lcov'],
		tempDir: path.join(__dirname, "..", "..", "..", "coverage", ".nyc_output"),
		reportDir: path.join(__dirname, "..", "..", "..", "coverage"),
		instrument: true,
		hookRequire: true,
		hookRunInContext: true,
		hookRunInThisContext: true,
		require: [
				'ts-node/register',
				'source-map-support/register'
		],
		include: [ "**/out/**/*.js" ]
	});

	nyc.reset();
	nyc.wrap();

	Object.keys(require.cache).filter(f => nyc.exclude.shouldInstrument(f)).forEach(m => {
		console.warn('Module loaded before NYC, invalidating:', m);
		delete require.cache[m];
		require(m);
	});


	return nyc;
  }

export async function run(): Promise<void> {
	const nyc = setupCoverage();
	await nyc.createTempDirectory();

	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		timeout: 20000,
		reporter: 'mocha-junit-reporter',
		reporterOptions: {
			mochaFile: 'artifacts/mocha_results_proj1.xml'
		}
	});

	const testsRoot = path.resolve(__dirname, '../..');
	const options = { cwd: testsRoot };
	const files = glob.sync("**/**.proj1.test.js", options);

	// console.log('Glob verification', await nyc.exclude.glob(nyc.cwd));
    for (const file of files) {
        mocha.addFile(path.resolve(testsRoot, file));
    }
    try {
		console.log("----- await promise")
        await new Promise<void>((resolve, reject) => {
			console.log("----- running mocha")
            mocha.run(failures => (failures ? reject(new Error(`${failures} tests failed`)) : resolve()))
			console.log("----- mocha complete")
		});
		console.log("----- promise complete")
    } finally {
		console.log("finally!")
        if (nyc !== undefined) {
			console.log("writing coverage file")
            nyc.writeCoverageFile();
            await nyc.report();
			console.log("coverage file written")
        }
    }

}
