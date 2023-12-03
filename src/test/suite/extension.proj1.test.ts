import * as assert from 'assert'
import { afterEach, beforeEach } from 'mocha'
import { commands, Selection, Uri, window, workspace } from 'vscode'
import { doesFileExist, getTestCount, sleep, getWorkspaceUri, runAllTests } from '../common'


const projName = 'proj1'
const workspaceUri = getWorkspaceUri()

beforeEach(async () => {
    console.log("beforeEach")
	await workspace.getConfiguration('ablunit').update('files.exclude', undefined)
})

afterEach(async () => {
	console.log("afterEach")
	await workspace.getConfiguration('ablunit').update('files.exclude', undefined)
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - output files exist - 1', async () => {
		await runAllTests()

		const ablunitJson = Uri.joinPath(workspaceUri,'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceUri,'results.xml')
		const resultsJson = Uri.joinPath(workspaceUri,'results.json')

		assert(await doesFileExist(ablunitJson),"missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml),"missing results.xml (" + resultsXml.fsPath + ")")
		assert(await doesFileExist(resultsJson),"missing results.json (" + resultsJson.fsPath + ")")
	})

	test(projName + '.2 - output files exist 2 - exclude compileError.p', async () => {
		await workspace.getConfiguration('ablunit').update('files.exclude', [ ".builder/**", "compileError.p" ])
		await sleep(500)

		await runAllTests()
		const resultsJson = Uri.joinPath(workspaceUri,'results.json')
		const testCount = await getTestCount(resultsJson)
		console.log("getTestCount: " + testCount)
		assert.equal(11,testCount)
	})

	test(projName + '.3 - run test case in file', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri,'procedureTest.p'))
		await sleep(200)
		await commands.executeCommand('testing.runCurrentFile')

		const resultsJson = Uri.joinPath(workspaceUri,'results.json')
		const testCount = await getTestCount(resultsJson)
		const pass = await getTestCount(resultsJson, 'pass')
		const fail = await getTestCount(resultsJson, 'fail')
		const error = await getTestCount(resultsJson, 'error')
		console.log("getTestCount: " + testCount)
		assert.equal(5,testCount)
		assert.equal(1,pass)
		assert.equal(2,fail)
		assert.equal(2,error)
	})

	test(projName + '.4 - run test case at cursor', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri,'procedureTest.p'))
		if(window.activeTextEditor) {
			window.activeTextEditor.selection = new Selection(21, 0, 21, 0)
		} else {
			assert.fail("vscode.window.activeTextEditor is undefined")
		}
		await commands.executeCommand('testing.runAtCursor')

		const resultsJson = Uri.joinPath(workspaceUri,'results.json')
		const testCount = await getTestCount(resultsJson)
		const pass = await getTestCount(resultsJson, 'pass')
		const fail = await getTestCount(resultsJson, 'fail')
		const error = await getTestCount(resultsJson, 'error')
		console.log("getTestCount: " + testCount)
		assert.equal(1,testCount)
		assert.equal(1,pass)
		assert.equal(0,fail)
		assert.equal(0,error)
	})

})
