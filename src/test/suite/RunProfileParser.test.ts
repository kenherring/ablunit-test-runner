
import * as assert from 'assert'
import { Uri, WorkspaceFolder, workspace } from 'vscode'
import { IConfigurations, parseRunProfiles } from '../../parse/TestProfileParser'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function readValidationFile (filename: string) {
	const uri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'validation', filename)
	return workspace.fs.readFile(uri).then((content) => {
		const data = Buffer.from(content.buffer).toString().trim().replace(/[\r\t\n]/g,'').replace(/\/\/.*/g,'').replace(/^$/g,'')
		const conf = <IConfigurations>JSON.parse(data)
		return JSON.stringify(conf.configurations)
	}, (err) => {
		console.error("reading validation file failed: " + err)
		throw err
	})
}

function getWorkspaceFolders () {
	const workspaceFolders: WorkspaceFolder[] = []
	for (const workspaceFolder of workspace.workspaceFolders!) {
		workspaceFolders.push(workspaceFolder)
	}
	return workspaceFolders
}

suite('RunProfileParser.test', () => {

	////////// SETUP
	const workspaceFolders = getWorkspaceFolders()
	if (!workspaceFolders) {
		throw new Error("unable to find workspaceFolders - failing test1")
	}

	test("test1", async () => {
		const result = parseRunProfiles(workspaceFolders)
		let profiles
		try{
			profiles = await result
		} catch (err) {
			console.error("caught error in parseRunProfiles! err = " + err)
			assert.fail("caught error in parseRunProfiles! err = " + err)
		}
		assert.equal(profiles.length, 1, "profiles.length = 1")
		assert.equal(profiles[0].hide, false, "hide=false")
	})

	// test("test2 - modified files.include & files.exclude", async () => {
	// 	const res = JSON.stringify(await parseRunProfiles(workspaceFolders, 'ablunit-test-profile.test2.json'))
	// 	const val = await readValidationFile('ablunit-test-profile.val-test2.json')
	// 	assert.strictEqual(res,val)
	// 	return workspaceFolders
	// })

})
