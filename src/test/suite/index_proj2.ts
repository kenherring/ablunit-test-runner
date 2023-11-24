import { runTests, setupMocha, setupNyc } from "../indexCommon"

const projName = 'proj2'

export function run(): Promise <void> {
	const nyc = setupNyc(projName)
	const mocha = setupMocha(projName)
	return runTests(projName, mocha, nyc)
}
