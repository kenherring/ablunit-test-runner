
import * as assert from 'assert'
import { Uri, WorkspaceFolder, extensions, workspace } from 'vscode'
import { IConfigurations, parseRunProfiles } from '../../parse/RunProfileParser'

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
	const extensionUri = extensions.getExtension("kherring.ablunit-test-provider")?.extensionUri
	if (!extensionUri) {
		throw new Error("unable to find extensionUri - failing test1")
	}
	const extensionResources = Uri.joinPath(extensionUri, 'resources')
	const workspaceFolders = getWorkspaceFolders()
	if (!workspaceFolders) {
		throw new Error("unable to find workspaceFolders - failing test1")
	}

	test("test1", async () => {
		const result = parseRunProfiles(extensionResources, workspaceFolders)
		let profiles
		try{
			profiles = await result
		} catch (err) {
			console.error("caught error in parseRunProfiles! err = " + err)
			assert.fail("caught error in parseRunProfiles! err = " + err)
		}
		assert.equal(profiles.length, 2, "profiles.length = 2")
		assert.equal(profiles[0].runProfile, "run", "runProfile = run")
		assert.equal(profiles[1].runProfile, "debug", "runProfile = debug")
	})

	test("test2", async () => {
		const res = JSON.stringify(await parseRunProfiles(extensionResources, workspaceFolders, 'ablunit-test-profile.test2.json'))
		const val = await readValidationFile('ablunit-test-profile.val-test2.json')
		assert.strictEqual(res,val)
		return workspaceFolders
	})

})
