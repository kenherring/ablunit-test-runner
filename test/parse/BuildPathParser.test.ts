import { getDLC, getOEVersion, getOpenEdgeProfileConfig, getBuildPathPatterns } from 'parse/OpenedgeProjectParser'
import { assert, getWorkspaceFolders, log, suiteSetupCommon } from '../testCommon'
import { toUri } from 'FileUtils'

const workspaceFolder = getWorkspaceFolders()[0]

suiteSetup('suiteSetup', async () => {
	await suiteSetupCommon()
})

setup('setup', () => {
	log.info('----- setup -----')
})

test('BuildPathParser.test.1', () => {
	const config = getOpenEdgeProfileConfig(toUri('openedge-project.test.json'))
	if (!config) {
		throw new Error('config openedge-project.test7.json is undefined')
	}

	for (const b of config.buildPath.filter(b => b.type == 'source') ?? []) {
		const buildPathPatterns = getBuildPathPatterns(workspaceFolder, b)

		if (!buildPathPatterns.includes) {
			throw new Error('buildPathPatterns.includes is undefined')
		}

		assert.equal(buildPathPatterns.includes.length, 2)
		assert.equal(buildPathPatterns.includes[0].pattern, 'src/Keep/Me/**')
		assert.equal(buildPathPatterns.includes[1].pattern, 'src/Also/Keep/**')

		if (!buildPathPatterns.excludes) {
			throw new Error('buildPathPatterns.excludes is undefined')
		}

		assert.equal(buildPathPatterns.excludes.length, 2)
		assert.equal(buildPathPatterns.excludes[0].pattern, 'src/Not/This/*.p')
		assert.equal(buildPathPatterns.excludes[1].pattern, 'src/Not/This/*.cls')

	}
})
