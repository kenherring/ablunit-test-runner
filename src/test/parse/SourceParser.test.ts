import * as assert from 'assert';
import { readFileSync } from 'fs';
import { after, before } from 'mocha';

import { parseSuiteClassFunc } from '../../parse/SourceParser'
import path = require('path');

const projName = 'proj0'

before(async () => {
    console.log("before")
})

after(() => {
	console.log("after")
})

suite('SourceParser Test Suite', () => {

	test('simple test class', async () => {
		const lines = readLinesFromFile('test_projects/proj5_suites/test/suite1.cls')
		parseSuiteClassFunc(lines)
		assert.strictEqual(true, false)
	})
})

function readLinesFromFile (file: string) {
	const filepath = path.resolve(__dirname, '..', '..', '..', file)
	console.log(filepath)
	const content = readFileSync(filepath).toString()
	return content.replace(/\r/g,'').split(/\n/)
}
