import * as assert from 'assert'
import path = require('path')
import { Uri } from 'vscode'
import { parseTestClass } from '../../parse/TestClassParser'
import { parseSuiteLines } from '../../parse/TestSuiteParser'
import { getWorkspaceUri, runAllTests, doesFileExist } from '../testCommon'
import { getContentFromFilesystem } from '../../parse/ProfileParser'
import { getLines } from '../../parse/TestParserCommon'


const projName = 'proj6'
const workspaceUri = getWorkspaceUri()

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - ablunit json file', async () => {
		await runAllTests()
		const ablunitJson = Uri.joinPath(workspaceUri,'.ablunit','ablunit.json')
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
	})

})
