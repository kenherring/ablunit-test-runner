import * as assert from 'assert'
import { Uri } from 'vscode'
import { doesFileExist, getWorkspaceUri, runAllTests } from '../testCommon'


const projName = 'proj2'
const workspaceUri = getWorkspaceUri()

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - temp/ablunit.json file exists', async () => {
		await runAllTests()

		const ablunitJson = Uri.joinPath(workspaceUri,'temp','ablunit.json')
		assert(await doesFileExist(ablunitJson),"missing ablunit.json (" + ablunitJson.fsPath + ")")
	})

})
