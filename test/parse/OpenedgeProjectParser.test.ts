import { getDLC, getOEVersion } from 'parse/OpenedgeProjectParser'
import { assert, getWorkspaceFolders, log } from '../testCommon'

const workspaceFolder = getWorkspaceFolders()[0]

suiteSetup('suiteSetup', () => {
	log.info('----- suiteSetup -----')
})

setup('setup', () => {
	log.info('----- setup -----')
})

test('OpenedgeProjectParser.test.1', () => {
	log.info('----- test.1 -----')
	if (!workspaceFolder) {
		throw new Error('workspaceFolder is undefined')
	}

	const oeversion = getOEVersion(workspaceFolder)
	const envOEVersionParts = (process.env['ABLUNIT_TEST_RUNNER_OE_VERSION'] ?? '12.8.1').split('.')
	envOEVersionParts.pop()
	const envOEVersion = (envOEVersionParts ?? '12.8.1').join('.')
	assert.equal(oeversion, envOEVersion)

	const dlc = getDLC(workspaceFolder)
	if (process.env['OS'] == 'Windows_NT') {
		assert.equal(dlc.uri.fsPath, 'c:\\Progress\\OpenEdge-12.8')
	} else {
		assert.equal(dlc.uri.fsPath, '/psc/dlc')
	}
})
