import { PropathParser } from '../../src/ABLPropath'
import { getSourceMapFromRCode } from '../../src/parse/RCodeParser'
import * as vscode from 'vscode'
import { Uri, assert, awaitRCode, getWorkspaceUri, log, sleep2, suiteSetupCommon, workspace } from '../testCommon'

suite('DebugLinesSuite', () => {

	suiteSetup('DebugLines - suiteSetup', suiteSetupCommon)

	setup('DebugLines - setup', async () => {
		await awaitRCode(workspace.workspaceFolders![0], 8).then((rcodeCount) => {
			log.info('compile complete! rcode count = ' + rcodeCount)
			return rcodeCount
		}, (err) => {
			log.error('compile error! err=' + err)
			throw err
		})
		log.info('setup complete!')
	})

	test('DebugLines.1 - read debug line map from r-code', async () => {
		const propath = new PropathParser(workspace.workspaceFolders![0])
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test1.r'))
		assert.equal(7, sourceMap.items.length)

		assert.equal('src/inc/unit_inc1.i', sourceMap.items[2].sourcePath)
		assert.equal(1, sourceMap.items[2].sourceLine)
		assert.equal(7, sourceMap.items[2].debugLine)

		assert.equal('src/code/unit_test1.p', sourceMap.items[6].sourcePath)
		assert.equal(10, sourceMap.items[6].sourceLine)
		assert.equal(13, sourceMap.items[6].debugLine)
	})

	test('DebugLines.2 - read debug line map from r-code', async () => {
		const propath = new PropathParser(workspace.workspaceFolders![0])
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test2.r'))
		assert.equal(7, sourceMap.items.length)

		assert.equal('src/inc/unit_inc1.i', sourceMap.items[2].sourcePath)
		assert.equal(1, sourceMap.items[2].sourceLine)
		assert.equal(7, sourceMap.items[2].debugLine)

		assert.equal('src/code/unit_test2.p', sourceMap.items[6].sourcePath)
		assert.equal(11, sourceMap.items[6].sourceLine)
		assert.equal(15, sourceMap.items[6].debugLine)
	})

	test('DebugLines.3 - read debug line map from r-code', async () => {
		const propath = new PropathParser(workspace.workspaceFolders![0])
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test3.r'))
		assert.equal(7, sourceMap.items.length)

		assert.equal('src/inc/unit_inc3.i', sourceMap.items[2].sourcePath)
		assert.equal(1, sourceMap.items[2].sourceLine)
		assert.equal(9, sourceMap.items[2].debugLine)

		assert.equal('src/code/unit_test3.p', sourceMap.items[6].sourcePath)
		assert.equal(12, sourceMap.items[6].sourceLine)
		assert.equal(15, sourceMap.items[6].debugLine)
	})

	test('DebugLines.4 - read debug line map from r-code', async () => {
		const propath = new PropathParser(workspace.workspaceFolders![0])
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test4.r'))
		assert.equal(5, sourceMap.items.length)

		assert.equal('src/code/unit_test4.p', sourceMap.items[4].sourcePath)
		assert.equal(11, sourceMap.items[4].sourceLine)
		assert.equal(11, sourceMap.items[4].debugLine)
	})

	test('DebugLines.5 - read debug line map for class from r-code', async () => {
		const propath = new PropathParser(workspace.workspaceFolders![0])
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test5.r'))
		assert.equal(9, sourceMap.items.length)

		// test_method_1
		assert.equal('src/code/unit_test5.cls', sourceMap.items[0].sourcePath, 'sourcePath #0')
		assert.equal(4, sourceMap.items[0].sourceLine, 'sourceLine #0')
		assert.equal(4, sourceMap.items[0].debugLine, 'debugLine #0')

		// test_method_2
		assert.equal('src/code/unit_test5.cls', sourceMap.items[2].sourcePath, 'sourcePath #2')
		assert.equal(8, sourceMap.items[2].sourceLine, 'sourceLine #2')
		assert.equal(8, sourceMap.items[2].debugLine, 'debugLine #2')

		assert.equal('src/inc/unit_inc5.i', sourceMap.items[3].sourcePath, 'sourcePath #3')
		assert.equal(1, sourceMap.items[3].sourceLine, 'sourceLine #3')
		assert.equal(10, sourceMap.items[3].debugLine, 'debugLine #3')

		assert.equal('src/code/unit_test5.cls', sourceMap.items[7].sourcePath, 'sourcePath #7')
		assert.equal(10, sourceMap.items[7].sourceLine, 'sourceLine #7')
		assert.equal(22, sourceMap.items[7].debugLine, 'debugLine #7')
	})
})
