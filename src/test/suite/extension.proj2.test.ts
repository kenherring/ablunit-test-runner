import * as assert from 'assert';
import { after, before } from 'mocha';
import * as vscode from 'vscode';
import { doesFileExist, getWorkspaceUri, runAllTests } from '../common'


const projName = 'proj2'
const workspaceUri = getWorkspaceUri()

before(async () => {
    console.log("before")
})

after(() => {
	console.log("after")
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - temp/ablunit.json file exists', async () => {
		await runAllTests()

		const ablunitJson = vscode.Uri.joinPath(workspaceUri,'temp','ablunit.json')
		assert(await doesFileExist(ablunitJson),"missing ablunit.json (" + ablunitJson.fsPath + ")")
	})

})
