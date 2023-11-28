import * as assert from 'assert';
import { readFileSync } from 'fs';
import { after, before } from 'mocha';

import { parseTestClass } from '../../parse/TestClassParser'
import { parseTestSuite } from '../../parse/TestSuiteParser'
import path = require('path');
import { Uri } from 'vscode';

const projName = 'proj0'

before(async () => {
    console.log("before")
})

after(() => {
	console.log("after")
})

suite('SourceParser Test Suite - proj5', () => {

	const workspaceDir = Uri.parse(path.resolve(__dirname, '..', '..', '..', 'test_projects', 'proj5_suites'))

	////////// TEST SUITES //////////

	test('test suite - suite1.cls', async () => {
		const lines = readLinesFromFile('test/suites/suite1.cls')
		const suiteRet = parseTestSuite(lines)
		assert.strictEqual(suiteRet.name, "suites.suite1")
		assert.strictEqual(suiteRet.classes.length, 4)
		assert.strictEqual(suiteRet.procedures.length, 7)
	})

	////////// TEST CLASSES //////////

	test("test class - login/test2.cls - ablunit.display.classLabel=classname (default)", async () => {
		const lines = readLinesFromFile('test/login/test2.cls')
		const classRet = parseTestClass(lines, 'classname', 'login/test2.cls', Uri.joinPath(workspaceDir, 'src/login/test2.cls'))
		assert.strictEqual(classRet.classname, "login.test2")
	})

	test("test class - login/test2.cls - ablunit.display.classLabel=filepath", async () => {
		const lines = readLinesFromFile('test/login/test2.cls')
		const classRet = parseTestClass(lines, 'filepath', 'login/test2.cls', Uri.joinPath(workspaceDir, 'src/login/test2.cls'))
		assert.strictEqual(classRet.classname, "login/test2.cls")
	})

})

function readLinesFromFile (file: string) {
	const filepath = path.resolve(__dirname, '..', '..', '..', 'test_projects', 'proj5_suites', file)
	const content = readFileSync(filepath).toString()
	return content.replace(/\r/g,'').split(/\n/)
}
