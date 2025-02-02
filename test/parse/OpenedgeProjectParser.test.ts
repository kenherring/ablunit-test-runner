import { getDLC, getOEVersion,  } from 'parse/OpenedgeProjectParser'
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
	assert.equal(oeversion, '12.8')

	const dlc = getDLC(workspaceFolder)
	if (process.env['OS'] == 'Windows_NT') {
		assert.equal(dlc.uri.fsPath, 'c:\\Progress\\OpenEdge-12.8')
	} else {
		assert.equal(dlc.uri.fsPath, '/psc/dlc')
	}
})
