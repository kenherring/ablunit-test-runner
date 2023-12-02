import * as assert from 'assert';
import { afterEach, beforeEach } from 'mocha';
import * as vscode from 'vscode';
import { doesFileExist, getTestCount, sleep, getWorkspaceUri, runAllTests } from '../common'


const projName = 'proj1'
const workspaceUri = getWorkspaceUri()

beforeEach(async () => {
    console.log("beforeEach")
	await vscode.workspace.getConfiguration('ablunit').update('files.exclude', undefined)
})

afterEach(async () => {
	console.log("afterEach")
	await vscode.workspace.getConfiguration('ablunit').update('files.exclude', undefined)
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - output files exist - 1', async () => {
		await runAllTests()

		const ablunitJson = vscode.Uri.joinPath(workspaceUri,'ablunit.json')
		const resultsXml = vscode.Uri.joinPath(workspaceUri,'results.xml')
		const resultsJson = vscode.Uri.joinPath(workspaceUri,'results.json')

		assert(await doesFileExist(ablunitJson),"missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml),"missing results.xml (" + resultsXml.fsPath + ")")
		assert(await doesFileExist(resultsJson),"missing results.json (" + resultsJson.fsPath + ")")
	})

	test(projName + '.2 - output files exist 2 - exclude compileError.p', async () => {
		await vscode.workspace.getConfiguration('ablunit').update('files.exclude', [ ".builder/**", "compileError.p" ])
		sleep(500)
		await runAllTests()

		const resultsJson = vscode.Uri.joinPath(workspaceUri,'results.json')
		const testCount = await getTestCount(resultsJson)
		console.log("getTestCount: " + testCount)
		assert.equal(10,testCount)
	})

})
