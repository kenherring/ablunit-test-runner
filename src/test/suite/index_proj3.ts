import { setupNyc, setupMocha, runTests } from "../indexCommon"

const projName = 'proj3'

export function run(): Promise <void> {
	const nyc = setupNyc(projName);
	const mocha = setupMocha(projName)
	return runTests(projName, mocha, nyc)
}
