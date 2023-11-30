import * as vscode from 'vscode'
import * as assert from 'assert'
import path = require('path')
import { parseTestClass } from '../../parse/TestClassParser'
import { parseTestSuite } from '../../parse/TestSuiteParser'
import { getTestCount, sleep } from '../common'
import { getContentFromFilesystem } from '../../parse/ProfileParser'
import { getLines } from '../../parse/TestParserCommon'

const projName = 'proj0'

suite('SourceParser Test Suite - proj5', () => {

	const workspaceDir = vscode.workspace.workspaceFolders![0].uri

	test('testCount', async () => {
		await vscode.commands.executeCommand('testing.refreshTests')
		await sleep(500)

		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		const resultsJson = vscode.Uri.joinPath(workspaceDir,'ablunit','results.json')
		const testCount = await getTestCount(resultsJson)
		assert(testCount > 100)
	})


	////////// TEST SUITES //////////

	test('test suite - suite1.cls', async () => {
		const lines = await readLinesFromFile('test/suites/suite1.cls',"@testsuite")
		const suiteRet = parseTestSuite(lines)
		assert.strictEqual(suiteRet.name, "suites.suite1")
		assert.strictEqual(suiteRet.classes.length, 4, "expected 4 classes in suite1.cls")
		assert.strictEqual(suiteRet.procedures.length, 7, "expected 7 procedures in suite1.cls")
	})

	////////// TEST CLASSES //////////

	test("test class - login/test2.cls - ablunit.display.classLabel=classname (default)", async () => {
		const lines = await readLinesFromFile('test/login/test2.cls')
		const classRet = parseTestClass(lines, 'classname', 'login/test2.cls', vscode.Uri.joinPath(workspaceDir, 'src/login/test2.cls'))
		assert.strictEqual(classRet.classname, "login.test2")
	})

	test("test class - login/test2.cls - ablunit.display.classLabel=filepath", async () => {
		const lines = await readLinesFromFile('test/login/test2.cls')
		const classRet = parseTestClass(lines, 'filepath', 'login/test2.cls', vscode.Uri.joinPath(workspaceDir, 'src/login/test2.cls'))
		assert.strictEqual(classRet.classname, "login/test2.cls")
	})

})


async function readLinesFromFile (file: string, annotation: string = "@test") {
	const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, file)
	return getContentFromFilesystem(uri).then((content) => {
		const [ lines, ] = getLines(content, annotation)
		return lines
	}, (err) => {
		console.error("ERROR: " + err)
		throw err
	})
}
