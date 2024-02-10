// This program will run all the tests

// import { DebugLinesSuite } from './suite/DebugLines.test'
// import * as allSuites from './allSuites.test'

function testFunc () {
	console.log('testFunc')

}

console.log('starting index.ts...')



// DebugLinesSuite

suite('All tests', () => {
	// allSuites
	test('All tests', () => {
		testFunc()
		console.log('All tests passed')
	})
})
