import * as assert from 'assert';
import { before, afterEach } from 'mocha';
import * as vscode from 'vscode';
import { doesDirExist, doesFileExist, getDefaultDLC, getSessionTempDir, runAllTests, setRuntimes } from '../common'


const projName = 'proj4'
const sessionTempDir = vscode.Uri.parse(getSessionTempDir())

before(async () => {
	await setRuntimes([{name: "11.7", path: "/psc/dlc_11.7"},{name: "12.2", path: getDefaultDLC()}])
})

afterEach(async () => {
	await vscode.workspace.getConfiguration('ablunit').update('profilerOptions.listings','c:\\temp\\ablunit-local\\listings')
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - Absolute Paths', async () => {
		const listingsDir = vscode.Uri.joinPath(sessionTempDir,'listings')
		const resultsXml = vscode.Uri.joinPath(sessionTempDir,'tempDir','results.xml')
		await vscode.workspace.getConfiguration('ablunit').update('profilerOptions.listings', listingsDir.fsPath)
		await vscode.workspace.getConfiguration('ablunit').update('tempDir', vscode.Uri.joinPath(sessionTempDir,'tempDir').fsPath)

		await runAllTests()

		assert(await doesFileExist(resultsXml),"missing results file (" + resultsXml.fsPath + ")")
		assert(await doesDirExist(listingsDir),"missing listings directory (" + listingsDir.fsPath + ")")
	})

})
