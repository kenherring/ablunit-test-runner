import { Uri, workspace } from 'vscode'
import { assert, awaitRCode, getWorkspaceUri, log, suiteSetupCommon, toUri } from '../testCommon'
import { getSourceMapFromRCode } from 'parse/SourceMapRCodeParser'
import { PropathParser } from 'ABLPropath'

const workspaceFolder = workspace.workspaceFolders![0]

suite('debugLines - Debug Line Tests - insiders', () => {

	suiteSetup('debugLines - before', () => {
		const prom = suiteSetupCommon()
			.then(() => { return awaitRCode(workspaceFolder, 8) })
			.then((rcodeCount) => {
				log.info('rcodeCount=' + rcodeCount)
				return rcodeCount
			}, (e: unknown) => {
				log.error('rcode error: ' + e)
				throw e
			})
		return prom
	})

	test('debugLines.1 - read debug line map from rcode', async () => {
		const propath = new PropathParser(workspaceFolder)
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test1.r'))
		assert.equal(7, sourceMap.items.length)

		log.info('sourceMap.items[0]=' + JSON.stringify(sourceMap.items[0]))
		assert.equal('src/code/unit_test1.p', workspace.asRelativePath(sourceMap.items[0].sourceUri))
		assert.equal(1, sourceMap.items[0].sourceLine)

		assert.equal(toUri('src/inc/unit_inc1.i').fsPath, sourceMap.items[2].sourceUri.fsPath)
		assert.equal(1, sourceMap.items[2].sourceLine)
		assert.equal(7, sourceMap.items[2].debugLine)

		assert.equal(toUri('src/code/unit_test1.p').fsPath, sourceMap.items[6].sourceUri.fsPath)
		assert.equal(10, sourceMap.items[6].sourceLine)
		assert.equal(13, sourceMap.items[6].debugLine)
	})

	test('debugLines.2 - read debug line map from rcode', async () => {
		const propath = new PropathParser(workspaceFolder)
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test2.r'))
		assert.equal(7, sourceMap.items.length)

		assert.equal(toUri('src/inc/unit_inc1.i').fsPath, sourceMap.items[2].sourceUri.fsPath)
		assert.equal(1, sourceMap.items[2].sourceLine)
		assert.equal(7, sourceMap.items[2].debugLine)

		assert.equal(toUri('src/code/unit_test2.p').fsPath, sourceMap.items[6].sourcePath)
		assert.equal(11, sourceMap.items[6].sourceLine)
		assert.equal(15, sourceMap.items[6].debugLine)
	})

	test('debugLines.3 - read debug line map from rcode', async () => {
		const propath = new PropathParser(workspaceFolder)
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test3.r'))
		assert.equal(7, sourceMap.items.length)

		assert.equal(toUri('src/inc/unit_inc3.i').fsPath, sourceMap.items[2].sourcePath)
		assert.equal(1, sourceMap.items[2].sourceLine)
		assert.equal(9, sourceMap.items[2].debugLine)

		assert.equal(toUri('src/code/unit_test3.p').fsPath, sourceMap.items[6].sourcePath)
		assert.equal(12, sourceMap.items[6].sourceLine)
		assert.equal(15, sourceMap.items[6].debugLine)
	})

	test('debugLines.4 - read debug line map from rcode', async () => {
		const propath = new PropathParser(workspaceFolder)
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test4.r'))
		assert.equal(5, sourceMap.items.length)

		assert.equal(toUri('src/code/unit_test4.p').fsPath, sourceMap.items[4].sourcePath)
		assert.equal(11, sourceMap.items[4].sourceLine)
		assert.equal(11, sourceMap.items[4].debugLine)
	})

	test('debugLines.5 - read debug line map for class from rcode', async () => {
		const propath = new PropathParser(workspaceFolder)
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test5.r'))
		assert.equal(9, sourceMap.items.length)

		// test_method_1
		assert.equal(toUri('src/code/unit_test5.cls'), sourceMap.items[0].sourcePath, 'sourcePath #0')
		assert.equal(4, sourceMap.items[0].sourceLine, 'sourceLine #0')
		assert.equal(4, sourceMap.items[0].debugLine, 'debugLine #0')

		// test_method_2
		assert.equal(toUri('src/code/unit_test5.cls'), sourceMap.items[2].sourcePath, 'sourcePath #2')
		assert.equal(8, sourceMap.items[2].sourceLine, 'sourceLine #2')
		assert.equal(8, sourceMap.items[2].debugLine, 'debugLine #2')

		assert.equal(toUri('src/inc/unit_inc5.i'), sourceMap.items[3].sourcePath, 'sourcePath #3')
		assert.equal(1, sourceMap.items[3].sourceLine, 'sourceLine #3')
		assert.equal(10, sourceMap.items[3].debugLine, 'debugLine #3')

		assert.equal(toUri('src/code/unit_test5.cls'), sourceMap.items[7].sourcePath, 'sourcePath #7')
		assert.equal(10, sourceMap.items[7].sourceLine, 'sourceLine #7')
		assert.equal(22, sourceMap.items[7].debugLine, 'debugLine #7')
	})

	test('debugLines.6 - include lines are executable', async () => {
		const propath = new PropathParser(workspaceFolder)
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/test6.r'))

		assert.equal(sourceMap.items[0].debugUri.fsPath, toUri('src/test6.p').fsPath, 'debugUri[0]')
		for (let i=0; i < sourceMap.items.length ; i++) {
			const line = sourceMap.items[i]
			log.info('i=' + i + ': '+ workspace.asRelativePath(line.debugUri) + ':' + line.debugLine + ' -> ' + workspace.asRelativePath(line.sourceUri) + ':' + line.sourceLine + ', proc=' + line.procName)
		}

		assert.equal(sourceMap.items[6].sourceUri.fsPath, toUri('src/test6.p'), 'sourceUri[6]')
		assert.equal(sourceMap.items[6].debugUri.fsPath, toUri('src/test6.p'), 'debugUri[6]')
		assert.equal(sourceMap.items[6].sourceLine, 7, 'sourceLine[6]')
		assert.equal(sourceMap.items[6].debugLine, 16, 'debugLine[6]')

		assert.equal(sourceMap.items[9].sourceUri.fsPath, toUri('src/include6.i'), 'sourceUri[9]')
		assert.equal(sourceMap.items[9].debugUri.fsPath, toUri('src/test6.p'), 'debugUri[9]')
		assert.equal(sourceMap.items[9].sourceLine, 7, 'sourceLine[9]')
		assert.equal(sourceMap.items[9].debugLine, 27, 'debugLine[9]')
	})
})
