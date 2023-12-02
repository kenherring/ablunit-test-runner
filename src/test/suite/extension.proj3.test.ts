import * as assert from 'assert';
import { after, before } from 'mocha';
import * as vscode from 'vscode';
import { doesDirExist, doesFileExist, getDefaultDLC, getWorkspaceUri, runAllTests, setRuntimes } from '../common'


const projName = 'proj3'
const workspaceUri = getWorkspaceUri()

before(async () => {
	await setRuntimes([{name: "11.7", path: "/psc/dlc_11.7"}, {name: "12.2", path: getDefaultDLC(), default: true}])
})

after(() => {
	console.log("after")
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - target/ablunit.json file exists', async () => {
		await runAllTests()

		const ablunitJson = vscode.Uri.joinPath(workspaceUri,'target','ablunit.json')
		const resultsXml = vscode.Uri.joinPath(workspaceUri,'ablunit-output','results.xml')
		const listingsDir = vscode.Uri.joinPath(workspaceUri,'target','listings')

		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(await doesDirExist(listingsDir),"missing listings directory (" + listingsDir.fsPath + ")")
	})

})
