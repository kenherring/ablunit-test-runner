
import { IConfigurations } from 'parse/TestProfileParser'
import { IRunProfile, Uri, assert, getWorkspaceFolders, getWorkspaceUri, log, parseRunProfiles, suiteSetupCommon, workspace } from '../testCommon'

function readValidationFile (filename: string) {
	const uri = Uri.joinPath(getWorkspaceUri(), 'validation', filename)

	return workspace.fs.readFile(uri).then((content) => {
		const data = Buffer.from(content.buffer).toString().trim().replace(/[\r\t\n]/g, '').replace(/\/\/.*/g, '').replace(/^$/g, '')
		const conf: IConfigurations = JSON.parse(data) as IConfigurations
		return JSON.stringify(conf.configurations)
	}, (err) => {
		log.error('Reading validation file failed: ' + err)
		throw err
	})
}

suite('TestProfileParser suite', () => {

	suiteSetup('TestProfileParser - suiteSetup', async () => {
		await suiteSetupCommon()
	})

	test('TestProfileParser.test1', () => {
		const wsf = getWorkspaceFolders()
		if (wsf.length === 0) {
			assert.fail('wsf.length === 0')
			return
		}
		for (const ws of wsf) {
			log.info('w=' + ws.uri.fsPath)
		}
		const profiles: IRunProfile[] = parseRunProfiles(wsf)
		if (profiles.length !== 1) {
			assert.fail('profiles.length = 1 (profiles=' + JSON.stringify(profiles) + '\'')
		}
		assert.equal(profiles[0].hide, false, 'hide=false')
	})

	test('test2 - modified files.include & files.exclude', () => {
		const res = JSON.stringify(parseRunProfiles(getWorkspaceFolders(), 'ablunit-test-profile.test2.json'))
		return readValidationFile('ablunit-test-profile.val-test2.json')
			.then((val) => {
				assert.equal(res, val)
				return
			})
	})

})
