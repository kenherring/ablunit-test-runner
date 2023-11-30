import { runTests } from "../indexCommon"

export function run(): Promise <void> {
	return runTests('proj7', 50000)
}
