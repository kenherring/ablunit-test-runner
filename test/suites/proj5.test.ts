import { Uri } from 'vscode'
import { parseSuiteLines } from '../../src/parse/TestSuiteParser'
import { parseTestClass } from '../../src/parse/TestClassParser'
import { parseTestProgram } from '../../src/parse/TestProgramParser'
import { assert, getTestCount, getWorkspaceUri, runAllTests, suiteSetupCommon } from '../testCommon'
import { getAnnotationLines, getContentFromFilesystem, readLinesFromFile } from '../../src/parse/TestParserCommon'

const workspaceUri = getWorkspaceUri()

suite('proj5 - Extension Test Suite', () => {

	suiteSetup('proj5 - before', async () => {
		await suiteSetupCommon()
	})

	test('proj5.1 - test count', () => {
		const resultsJson = Uri.joinPath(workspaceUri, 'ablunit', 'results.json')
		const prom = runAllTests()
			.then(() => { return getTestCount(resultsJson) })
			.then((testCount) => {
				assert.greater(testCount, 100)
				return
			}, (e) => { throw e })
		return prom
	})


	// //////// TEST SUITES //////////

	test('proj5.2 - TestSuite - suite1.cls', async () => {
		const [ lines, ] = await getContentFromFilesystem('test/suites/suite1.cls')
			.then((content) => { return getAnnotationLines(content, '@testsuite') }, (e) => { throw e })
		const suiteRet = parseSuiteLines(lines)
		assert.equal(suiteRet.name, 'suites.suite1')
		assert.equal(suiteRet.classes.length, 4, 'expected 4 classes in suite1.cls')
		assert.equal(suiteRet.procedures.length, 7, 'expected 7 procedures in suite1.cls')
	})

	// //////// TEST CLASSES //////////

	test('proj5.3 - TestClass - login/test2.cls - ablunit.explorer.classlabel=class-type-name (default)', async () => {
		const lines = await readLinesFromFile('test/login/test2.cls')
		const classRet = parseTestClass(lines, 'class-type-name', 'login/test2.cls')
		assert.equal(classRet.classname, 'login.test2')
		assert.equal(classRet.label, 'login.test2')
	})

	test('proj5.4 - TestClass - login/test2.cls - ablunit.explorer.classlabel=filename', async () => {
		const lines = await readLinesFromFile('test/login/test2.cls')
		const classRet = parseTestClass(lines, 'filename', 'login/test2.cls')
		assert.equal(classRet.classname, 'login.test2')
		assert.equal(classRet.label, 'test2.cls')
	})

	test('proj5.5 - TestClass - login/test5.cls - test count', async () => {
		const lines = await readLinesFromFile('test/login/test5.cls')
		const classRet = parseTestClass(lines, 'filename', 'login/test5.cls')
		assert.equal(classRet.testcases.length, 8, 'testcase count in test/login/test5.cls')
	})

	test('proj5.6 - TestClass - login/test5.cls - test count', async () => {
		const lines = await readLinesFromFile('test/login/test7.cls')
		const classRet = parseTestClass(lines, 'filename', 'login/test7.cls')
		assert.equal(classRet.testcases.length, 0, 'testcase count in test/login/test5.cls')
	})

	// //////// TEST PROGRAMS //////////

	test('proj5.7 - TestProgram - test/proc2/proc2.p - test count', async () => {
		const lines = await readLinesFromFile('test/proc2/proc2.p')
		const classRet = parseTestProgram(lines, 'filename')
		assert.equal(classRet.testcases.length, 9, 'testcase count in test/proc2/proc2.p')
	})

	test('proj5.8 - TestClass - test/proc2/test7.p- test count', async () => {
		const lines = await readLinesFromFile('test/proc2/test7.p')
		const classRet = parseTestProgram(lines, 'filename')
		assert.equal(classRet.testcases.length, 0, 'testcase count in test/proc2/test7.p')
	})

})
