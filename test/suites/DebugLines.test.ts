import { commands, Selection, Uri, window, workspace, Disposable, extensions } from 'vscode'
import { assert, getRcodeCount, getWorkspaceUri, log, suiteSetupCommon, toUri } from '../testCommon'
import { getSourceMapFromRCode } from 'parse/SourceMapRCodeParser'
import { PropathParser } from 'ABLPropath'
import { ABLUnitTestRunner } from '@types'

const workspaceFolder = workspace.workspaceFolders![0]

async function validateSelectionAfterChange (uri: Uri, expectedSelection: number[]) {
	const waitTime = 1000

	const disposeMe: Disposable[] = []
	await new Promise<boolean>((resolve, reject) => {
		window.onDidChangeTextEditorSelection((e) => {
			if (e.textEditor.document.uri.fsPath == uri.fsPath) {
				resolve(true)
			}
			assert.selection(e.textEditor.selection, expectedSelection)
		}, disposeMe)
		setTimeout(() => {
			const message = 'timeout after ' + waitTime + 'ms waiting for onDidChangeTextEditorSelection for ' + uri.fsPath
			log.error(message)
			reject(new Error(message))
		}, waitTime)
	})
	for (const d of disposeMe) {
		d.dispose()
	}
}

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
	const sourceMap = await getSourceMapFromRCode(propath, toUri('out/test6.r'))

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

test('debugLines.7 - Debug Listing Preview', async () => {
	const sourceUri = toUri('src/code/unit_test7.p')
	const debugUri = toUri('src/code/unit_test7.p Debug Listing')

	await commands.executeCommand('workbench.action.closeAllEditors')
	await commands.executeCommand('vscode.open', sourceUri)

	if (!window.activeTextEditor) {
		assert.fail('no activeTextEditor found')
		throw new Error('no activeTextEditor found')
	}
	assert.equal(window.activeTextEditor.document.uri.fsPath, sourceUri.fsPath, 'activeTextEditor')
	window.activeTextEditor.selection = new Selection(15, 0, 15, 0)

	await commands.executeCommand('ablunit.showDebugListingPreview')
	assert.selection(window.activeTextEditor.selection, [15, 0, 15, 0])

	// validate initial selection from source editor cursor location
	log.info('validate intitial seletion...')
	const ext = extensions.getExtension('kherring.ablunit-test-runner')?.exports as ABLUnitTestRunner
	const d = ext.getDebugListingPreviewEditor(window.activeTextEditor.document.uri)
	if (!d) {
		assert.fail('no Debug Listing Preview open for ' + window.activeTextEditor.document.uri.fsPath)
		return
	}
	assert.equal(d?.document.uri.fsPath, debugUri.fsPath)
	assert.selection(d?.selection, [19, 0, 20, 0])

	// move cursor in source editor down two lines
	log.info('validate after cursor move...')
	window.activeTextEditor.selection = new Selection(17, 4, 17, 4)
	await validateSelectionAfterChange(debugUri, [21, 0, 22, 0])

	// make selection in debugListing and validate source selection is correct
	log.info('validate after selection in debugListing...')
	await commands.executeCommand('workbench.action.focusNextGroup')
	assert.equal(window.activeTextEditor.document.uri.fsPath, debugUri.fsPath, 'activeTextEditor after open debugUri')
	await commands.executeCommand('setSelection', { uri: debugUri, selection: new Selection(30, 0, 32, 4) })
	await validateSelectionAfterChange(sourceUri, [26,0, 82, 4 + 12])
})
