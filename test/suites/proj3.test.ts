import { Uri } from 'vscode'
import { assert, getDefaultDLC, getWorkspaceUri, log, runAllTests, setRuntimes, waitForExtensionActive } from '../testCommon'

const projName = 'proj3'
const workspaceUri = getWorkspaceUri()

suite('proj3 - Extension Test Suite', () => {

	suiteSetup('proj3 - before', async () => {
		return waitForExtensionActive()
	})

	setup('proj3 - setup', async () => {
		log.info('100')
		await setRuntimes([{name: '11.7', path: '/psc/dlc_11.7'}, {name: '12.2', path: getDefaultDLC(), default: true}]).then((r) => {
			log.info('110: ' + r)
		}, (e) => {
			log.error('120: e=' + e)
		})
		log.info('130')
	})

	test('proj3.1 - target/ablunit.json file exists', async () => {
		return runAllTests().then(() => {
			log.info('100')
			const ablunitJson = Uri.joinPath(workspaceUri, 'target', 'ablunit.json')
			const resultsXml = Uri.joinPath(workspaceUri, 'ablunit-output', 'results.xml')
			const listingsDir = Uri.joinPath(workspaceUri, 'target', 'listings')

			log.info('110')
			assert.fileExists(ablunitJson)
			assert.fileExists(resultsXml)
			assert.dirExists(listingsDir)
			log.info('120')
		})
	})

})
