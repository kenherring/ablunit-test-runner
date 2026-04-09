import { getDLC, getOEVersion, getOpenEdgeProfileConfig, getProfileDbConns } from 'parse/OpenedgeProjectParser'
import { assert, getWorkspaceFolders, log, suiteSetupCommon_logGroup } from '../testCommon'
import { toUri } from 'FileUtils'

const workspaceFolder = getWorkspaceFolders()[0]

suiteSetup('suiteSetup', () => {
	suiteSetupCommon_logGroup()
})

suiteTeardown('suiteTeardown', () => {
	log.group.end()
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

test('OpenedgeProjectParser.test.2', () => {
	const config = getOpenEdgeProfileConfig(workspaceFolder.uri)
	if (!config) {
		throw new Error('config is undefined')
	}

	assert.equal(JSON.stringify(config.propath), JSON.stringify(config.buildPath.map(x => x.build)))
})

test('OpenedgeProjectParser.test.3', () => {
	const config = getOpenEdgeProfileConfig(toUri('openedge-project.test3.json'))
	if (!config) {
		throw new Error('config is undefined')
	}

	assert.equal(JSON.stringify(config.propath), '["."]')
	assert.equal(JSON.stringify(config.buildPath.map(x => x.build)), '["dist"]')
})

test('OpenedgeProjectParser.test.4', () => {
	const config = getOpenEdgeProfileConfig(toUri('openedge-project.test4.json'))
	if (!config) {
		throw new Error('config is undefined')
	}

	assert.equal(JSON.stringify(config.propath), '["src"]')
	assert.equal(JSON.stringify(config.buildPath.map(x => x.build)), '["dist"]')
})

test('OpenedgeProjectParser.test.5', () => {
	const config = getOpenEdgeProfileConfig(toUri('openedge-project.test5.json'))
	if (!config) {
		throw new Error('config is undefined')
	}

	assert.equal(JSON.stringify(config.buildPath.map(x => x.build)), '["build"]')
})

test('OpenedgeProjectParser.test.6', () => {
	const config = getOpenEdgeProfileConfig(toUri('openedge-project.test6.json'))
	if (!config) {
		throw new Error('config is undefined')
	}

	assert.equal(JSON.stringify(config.buildPath.map(x => x.build)), '["src"]')
})

test('OpenedgeProjectParser.test.7a', () => {
	const dbConns = getProfileDbConns(toUri('openedge-project.test7.json'))
	assert.equal(dbConns.length, 1, 'Expected 1 DB connection!')
})

test('OpenedgeProjectParser.test.7b', () => {
	const dbConns = getProfileDbConns(toUri('openedge-project.test7.json'), 'NoDB-profile')
	assert.equal(dbConns.length, 0, 'Expected no DB connections!')
})

test('OpenedgeProjectParser.test.7c', () => {
	const dbConns = getProfileDbConns(toUri('openedge-project.test7.json'), 'inherited-profile')
	assert.equal(dbConns.length, 0, 'Expected no DB connections!')
})

test('OpenedgeProjectParser.test.7d', () => {
	const dbConns = getProfileDbConns(toUri('openedge-project.test7.json'), 'inherited-profile2')
	assert.equal(dbConns.length, 1, 'Expected 1 DB connection!')
})
