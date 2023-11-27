import path = require("path")
import { setupMocha, setupNyc } from "../indexCommon"

export function runUnitTests(): Promise <void> {
	const testsRoot = path.resolve(__dirname, "..");
	const nyc = setupNyc("unitTests")
	const mocha = setupMocha("unitTests")

	return new Promise<void>((c, e) => {
		mocha.addFile(path.resolve(testsRoot, "index_unitTests.ts"))
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
				c()
			});
		} catch (err) {
			console.error('[index_unitTests.ts] catch err= ' + err);
			e(err)
		}
	})
}
