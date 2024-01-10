import { strict as assert } from 'assert'
import { before } from 'mocha'
import { Uri, commands } from 'vscode'
import { doesFileExist, getWorkspaceUri, runAllTests, sleep, waitForExtensionActive } from '../testCommon'
import { recentResults } from '../../decorator'


const projName = 'proj2'
const workspaceUri = getWorkspaceUri()

before(async () => {
	await waitForExtensionActive()
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - temp/ablunit.json file exists', async () => {
		await runAllTests()

		const ablunitJson = Uri.joinPath(workspaceUri,'temp','ablunit.json')
		assert(await doesFileExist(ablunitJson),"missing ablunit.json (" + ablunitJson.fsPath + ")")
	})

	test(projName + '.2 - call stack', async () => {
		await commands.executeCommand('vscode.open', Uri.joinPath(workspaceUri,'src/classes/testClass2.cls'))
		await sleep(200)
		await commands.executeCommand('testing.runCurrentFile')

		const tc = recentResults?.[0].ablResults?.resultsJson[0].testsuite?.[0].testcases?.[0]
		const mdText = tc?.failure?.callstack?.items?.[1].markdownText
		if (!mdText) {
			assert.fail("mdText is null")
		}
		if (mdText.indexOf("testClass2.cls:file:///") > -1) {
			assert.fail("mdText should be testClasse.cls:6")
		}
	})

})
