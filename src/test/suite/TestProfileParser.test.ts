
import { strict as assert } from 'assert'
import { WorkspaceFolder, workspace } from 'vscode'
import { parseRunProfiles } from '../../parse/TestProfileParser'
import { log } from '../testCommon'

// ----------TODO---------- //
// function readValidationFile (filename: string) {
// 	const uri = Uri.joinPath(workspace.workspaceFolders![0].uri, 'validation', filename)
// 	return workspace.fs.readFile(uri).then((content) => {
// 		const data = Buffer.from(content.buffer).toString().trim().replace(/[\r\t\n]/g,'').replace(/\/\/.*/g,'').replace(/^$/g,'')
// 		const conf = JSON.parse(data) as IConfigurations
// 		return JSON.stringify(conf.configurations)
// 	}, (err) => {
// 		log.error("Reading validation file failed: " + err)
// 		throw err
// 	})
// }

function getWorkspaceFolders () {
	const workspaceFolders: WorkspaceFolder[] = []
	if (!workspace.workspaceFolders) {
		throw new Error('No workspaceFolders found')
	}
	for (const workspaceFolder of workspace.workspaceFolders) {
		workspaceFolders.push(workspaceFolder)
	}
	return workspaceFolders
}

suite('TestProfileParser.test', () => {

	// //////// SETUP
	const workspaceFolders = getWorkspaceFolders()

	test('test1', () => {
		let profiles
		try{
			profiles = parseRunProfiles(workspaceFolders)
		} catch (err) {
			log.error('Caught error in parseRunProfiles! err = ' + err)
			assert.fail('Caught error in parseRunProfiles! err = ' + err)
		}
		assert.equal(profiles.length, 1, 'profiles.length = 1')
		assert.equal(profiles[0].hide, false, 'hide=false')
	})

	// ----------TODO---------- //
	// test("test2 - modified files.include & files.exclude", async () => {
	// 	const res = JSON.stringify(await parseRunProfiles(workspaceFolders, 'ablunit-test-profile.test2.json'))
	// 	const val = await readValidationFile('ablunit-test-profile.val-test2.json')
	// 	assert.strictEqual(res,val)
	// 	return workspaceFolders
	// })

})
