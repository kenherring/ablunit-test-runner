import { commands, Uri, workspace, window } from 'vscode'
import { assert, getRcodeCount, getWorkspaceUri, log, suiteSetupCommon, toUri } from '../testCommon'
import { getSourceMapFromRCode } from 'parse/SourceMapRCodeParser'
import { PropathParser } from 'ABLPropath'
import { ABLDebugLines } from 'ABLDebugLines'
import { ABLUnitConfig } from 'ABLUnitConfigWriter'

const workspaceFolder = workspace.workspaceFolders![0]

suiteSetup('debugLines - before', async () => {
	await suiteSetupCommon(undefined, 10)
	const rcodeCount = getRcodeCount()
	if (rcodeCount < 10) {
		throw new Error('rcodeCount=' + rcodeCount + ' < 9')
	}
})

test('debugLines.1 - read debug line map from rcode', async () => {
	const propath = new PropathParser(workspaceFolder)
	const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test1.r'))
	assert.equal(9, sourceMap.items.length)
	assert.equal(7, sourceMap.items.filter(i => i.executable).length)
	sourceMap.items = sourceMap.items.filter(i => i.executable)

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
	assert.equal(9, sourceMap.items.length)
	assert.equal(7, sourceMap.items.filter(i => i.executable).length)
	sourceMap.items = sourceMap.items.filter(i => i.executable)

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
	assert.equal(9, sourceMap.items.length)
	assert.equal(7, sourceMap.items.filter(i => i.executable).length)
	sourceMap.items = sourceMap.items.filter(i => i.executable)

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
	assert.equal(11, sourceMap.items.length)
	assert.equal(9, sourceMap.items.filter(i => i.executable).length)
	sourceMap.items = sourceMap.items.filter(i => i.executable)

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
	const sourceMap = await getSourceMapFromRCode(propath, toUri('out/test6.r'))
	sourceMap.items = sourceMap.items.filter(i => i.executable)

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

 test('debugLines.7A - comment alignment for source', async () => {
	log.info('-------------------- debugLines.7A --------------------')
	const debugLines = new ABLDebugLines((new ABLUnitConfig(workspaceFolder, undefined, false)).readPropathFromJson())
	const sourceUri = toUri('src/code/unit_test7.p')
	const includeUri = toUri('src/inc/include_7A.i')

	assert.position(await debugLines.getSourcePosition(sourceUri, [0, 0]), sourceUri, [0, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [1, 0]), sourceUri, [1, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [2, 0]), sourceUri, [2, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [3, 0]), sourceUri, [3, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [4, 0]), sourceUri, [4, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [5, 0]), sourceUri, [5, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [6, 0]), sourceUri, [6, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [7, 0]), includeUri, [0, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [8, 0]), includeUri, [1, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [9, 0]), includeUri, [2, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [10, 0]), includeUri, [3, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [11, 0]), includeUri, [4, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [12, 0]), includeUri, [5, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [13, 0]), includeUri, [6, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [14, 0]), includeUri, [7, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [15, 0]), includeUri, [8, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [16, 0]), includeUri, [9, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [17, 0]), includeUri, [10, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [18, 0]), includeUri, [11, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [19, 0]), includeUri, [12, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [20, 0]), includeUri, [13, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [21, 0]), includeUri, [14, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [22, 0]), includeUri, [15, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [23, 0]), sourceUri, [7, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [24, 0]), sourceUri, [8, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [25, 0]), sourceUri, [9, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [26, 0]), sourceUri, [10, 0])
	assert.position(await debugLines.getSourcePosition(sourceUri, [27, 0]), sourceUri, [11, 0])  // blank final line
	await debugLines.getSourcePosition(sourceUri, [28, 0])
		.then(() => {
			assert.fail('getSourcePosition should not resolve for line 29, expected to throw an error')
		}, (e: unknown) => {
			log.info('getSourcePosition for line 29 threw as expected: ' + e)
		})
	return
})

test('debugLines.7B - comment alignmen for debug listing', async () => {
	log.info('-------------------- debugLines.7B --------------------')
	const debugLines = new ABLDebugLines((new ABLUnitConfig(workspaceFolder, undefined, false)).readPropathFromJson())
	const sourceUri = toUri('src/code/unit_test7.p')
	const includeUri = toUri('src/inc/include_7A.i')

	const sourceEditor = await commands.executeCommand('workbench.action.closeAllEditors')
		.then(() => commands.executeCommand('vscode.open', sourceUri))
		.then(() => { return window.visibleTextEditors[0] })
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [0, 0]), sourceUri, [0, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [1, 0]), sourceUri, [1, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [2, 0]), sourceUri, [2, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [3, 0]), sourceUri, [3, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [4, 0]), sourceUri, [4, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [5, 0]), sourceUri, [5, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [6, 0]), sourceUri, [6, 12])
	const includeEditor = await commands.executeCommand('workbench.action.closeAllEditors')
		.then(() => commands.executeCommand('vscode.open', includeUri))
		.then(() => { return window.visibleTextEditors[0] })
	assert.notEqual(includeEditor, sourceEditor, 'includeEditor should not be the same as sourceEditor')
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [0, 0]), sourceUri, [7, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [1, 0]), sourceUri, [8, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [2, 0]), sourceUri, [9, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [3, 0]), sourceUri, [10, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [4, 0]), sourceUri, [11, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [5, 0]), sourceUri, [12, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [6, 0]), sourceUri, [13, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [7, 0]), sourceUri, [14, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [8, 0]), sourceUri, [15, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [9, 0]), sourceUri, [16, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [10, 0]), sourceUri, [17, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [11, 0]), sourceUri, [18, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [12, 0]), sourceUri, [19, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [13, 0]), sourceUri, [20, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [14, 0]), sourceUri, [21, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, includeEditor, [15, 0]), sourceUri, [22, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [7, 0]), sourceUri, [23, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [8, 0]), sourceUri, [24, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [9, 0]), sourceUri, [25, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [10, 0]), sourceUri, [26, 12])
	assert.position(await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [11, 0]), sourceUri, [27, 12])

	await debugLines.getDebugListingPosition(sourceUri, includeEditor, [16, 0])
		.then(() => {
			assert.fail('getDebugListingPosition should not resolve for ' + includeUri.fsPath + ':16, expected to throw an error')
		}, (e: unknown) => {
			log.info('getDebugListingPosition for line 23 threw as expected: ' + e)
		})
	await debugLines.getDebugListingPosition(sourceUri, sourceEditor, [12, 0])
		.then(() => {
			assert.fail('getDebugListingPosition should not resolve for  28, expected to throw an error')
		}, (e: unknown) => {
			log.info('getDebugListingPosition for line 28 threw as expected: ' + e)
		})

})
