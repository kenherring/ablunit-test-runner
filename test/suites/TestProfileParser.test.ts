
import { IRunProfile, assert, getWorkspaceFolders, log, parseRunProfiles } from '../testCommon'

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

suite('TestProfileParser suite', () => {

	setup('TestProfileParser - setup', () => {
		log.info('setup started')
	})

	test('TestProfileParser.test1', () => {
		const wsf = getWorkspaceFolders()
		// const wsf = workspace.workspaceFolders
		if (wsf === undefined) {
			assert.fail('wsf === undefined')
			return
		}
		for (const ws of wsf) {
			log.info('w=' + ws.uri.fsPath)
		}
		const profiles: IRunProfile[] = parseRunProfiles(wsf)
		if ((profiles?.length ?? 0) !== 1) {
			assert.fail('profiles.length = 1 (profiles=' + JSON.stringify(profiles) + '\'')
		}
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
