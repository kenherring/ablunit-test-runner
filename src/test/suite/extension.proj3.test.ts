import * as assert from 'assert'
import { before } from 'mocha'
import { Uri } from 'vscode'
import { doesDirExist, doesFileExist, getDefaultDLC, getWorkspaceUri, runAllTests, setRuntimes } from '../testCommon'


const projName = 'proj3'
const workspaceUri = getWorkspaceUri()

before(async () => {
	await setRuntimes([{name: "11.7", path: "/psc/dlc_11.7"}, {name: "12.2", path: getDefaultDLC(), default: true}])
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - target/ablunit.json file exists', async () => {
		await runAllTests()

		const ablunitJson = Uri.joinPath(workspaceUri,'target','ablunit.json')
		const resultsXml = Uri.joinPath(workspaceUri,'ablunit-output','results.xml')
		const listingsDir = Uri.joinPath(workspaceUri,'target','listings')

		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(await doesDirExist(listingsDir),"missing listings directory (" + listingsDir.fsPath + ")")
	})

})
