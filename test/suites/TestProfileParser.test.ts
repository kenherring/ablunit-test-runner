import { parseRunProfiles } from 'parse/TestProfileParser'
import { assert, getWorkspaceFolders, log } from '../testCommon'

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
suite('TestProfileParserSuite', () => {

	test('TestProfileParser test1', () => {
		try{
			const profiles = parseRunProfiles(getWorkspaceFolders())
			assert.equal(profiles.length, 1, 'profiles.length = 1')
			assert.equal(profiles[0].hide, false, 'hide=false')
		} catch (err) {
			log.error('Caught error in parseRunProfiles! err = ' + err)
			assert.fail('Caught error in parseRunProfiles! err = ' + err)
		}
	})

	// ----------TODO---------- //
	// test("test2 - modified files.include & files.exclude", async () => {
	// 	const res = JSON.stringify(await parseRunProfiles(workspaceFolders, 'ablunit-test-profile.test2.json'))
	// 	const val = await readValidationFile('ablunit-test-profile.val-test2.json')
	// 	assert.strictEqual(res,val)
	// 	return workspaceFolders
	// })

})
