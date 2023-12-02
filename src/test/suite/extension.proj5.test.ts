import * as vscode from 'vscode'
import * as assert from 'assert'
import path = require('path')
import { parseTestClass } from '../../parse/TestClassParser'
import { parseTestSuite } from '../../parse/TestSuiteParser'
import { getTestCount, sleep, getWorkspaceUri, runAllTests } from '../common'
import { getContentFromFilesystem } from '../../parse/ProfileParser'
import { getLines } from '../../parse/TestParserCommon'


const projName = 'proj6'
const workspaceUri = getWorkspaceUri()

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - test count', async () => {
		await runAllTests()

		const resultsJson = vscode.Uri.joinPath(workspaceUri,'ablunit','results.json')
		const testCount = await getTestCount(resultsJson)
		assert(testCount > 100)
	})


	////////// TEST SUITES //////////

	test(projName + '.2 - TestSuite - suite1.cls', async () => {
		const lines = await readLinesFromFile('test/suites/suite1.cls',"@testsuite")
		const suiteRet = parseTestSuite(lines)
		assert.strictEqual(suiteRet.name, "suites.suite1")
		assert.strictEqual(suiteRet.classes.length, 4, "expected 4 classes in suite1.cls")
		assert.strictEqual(suiteRet.procedures.length, 7, "expected 7 procedures in suite1.cls")
	})

	////////// TEST CLASSES //////////

	test(projName + '.3 - TestClass - login/test2.cls - ablunit.display.classLabel=classname (default)', async () => {
		const lines = await readLinesFromFile('test/login/test2.cls')
		const classRet = parseTestClass(lines, 'classname', 'login/test2.cls', vscode.Uri.joinPath(workspaceUri, 'src/login/test2.cls'))
		assert.strictEqual(classRet.classname, "login.test2")
	})

	test(projName + '.4 - TestClass - login/test2.cls - ablunit.display.classLabel=filepath', async () => {
		const lines = await readLinesFromFile('test/login/test2.cls')
		const classRet = parseTestClass(lines, 'filepath', 'login/test2.cls', vscode.Uri.joinPath(workspaceUri, 'src/login/test2.cls'))
		assert.strictEqual(classRet.classname, "login/test2.cls")
	})

})


async function readLinesFromFile (file: string, annotation: string = "@test") {
	const uri = vscode.Uri.joinPath(workspaceUri, file)
	return getContentFromFilesystem(uri).then((content) => {
		const [ lines, ] = getLines(content, annotation)
		return lines
	}, (err) => {
		console.error("ERROR: " + err)
		throw err
	})
}
