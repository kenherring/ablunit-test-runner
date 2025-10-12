import { commands, Selection, window, extensions, Uri, Disposable } from 'vscode'
import { assert, getRcodeCount, log, sleep, suiteSetupCommon, toUri } from '../testCommon'
import { ABLUnitTestRunner } from '@types'

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
	await suiteSetupCommon(undefined, 1)
	const rcodeCount = getRcodeCount()
	if (rcodeCount < 1) {
		throw new Error('rcodeCount=' + rcodeCount + ' < 1')
	}
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

test('debugLines.8 - Debug Listing Preview with include', () => {
	const sourceUri = toUri('src/code/unit_test7.p')
	const debugUri = toUri('src/code/unit_test7.p Debug Listing')
	const includeUri = toUri('src/inc/include_7.i')

	return commands.executeCommand('workbench.action.closeAllEditors')
		.then(() => sleep(100))
		.then(() => commands.executeCommand('vscode.open', sourceUri))
		.then(() => sleep(100))
		.then(() => commands.executeCommand('ablunit.showDebugListingPreview'))
		.then(() => sleep(100))
		.then(() => {
			assert.equal(window.activeTextEditor?.document.uri.fsPath, sourceUri.fsPath, 'activeTextEditor')
			return commands.executeCommand('workbench.action.focusNextGroup')
		})
		.then(() => sleep(100))
		.then(() => {
			// log.info('activeTextEditor after open debugUri: ' + window.activeTextEditor?.document.uri.fsPath)
			const debugEditor = window.visibleTextEditors.find(e => e.document.uri.scheme == 'debugListing')
			assert.equal(debugEditor?.document.uri.fsPath, debugUri.fsPath, 'debugEditor')
			if (!debugEditor) {
				assert.fail('no debug editor found')
			}
			log.info('set debugEditor.selection')
			debugEditor!.selection = new Selection(42, 0, 42, 0)
			return sleep(100)
		})
		.then(() => sleep(100))
		.then(() => {
			const debugEditor = window.visibleTextEditors.filter(e => e.document.uri.scheme == 'debugListing')
			assert.equal(debugEditor.length, 1, 'should be only one debug editor open')
			assert.equal(debugEditor[0].document.uri.fsPath, debugUri.fsPath, 'debugEditor')
			assert.selection(debugEditor[0].selection, [42, 0, 42, 0], debugEditor[0].document.uri)
			const includeEditor = window.visibleTextEditors.filter(e => e.document.uri.fsPath != debugUri.fsPath)
			assert.equal(includeEditor.length, 1, 'should be one include editor open')
			assert.equal(includeEditor[0].document.uri.fsPath, includeUri.fsPath, 'include editor should be the only other visible editor')
			assert.selection(includeEditor[0].selection, [8, 0, 9, 0])
			return
		}, (e: unknown) => {
			log.error('Error in debugLines.8: ' + e)
			assert.fail('Error in debugLines.8: ' + e)
			throw e
		})
	return
})

test('debugLines.9 - Debug Listing Preview selection across files', async () => {
	const sourceUri = toUri('src/code/unit_test7.p')
	const debugUri = toUri('src/code/unit_test7.p Debug Listing')

	await commands.executeCommand('workbench.action.closeAllEditors')
		.then(() => sleep(100))
		.then(() => commands.executeCommand('vscode.open', sourceUri))
		.then(() => sleep(100))
		.then(() => commands.executeCommand('ablunit.showDebugListingPreview'))
		.then(() => sleep(100))
		.then(() => {
			assert.equal(window.activeTextEditor?.document.uri.fsPath, sourceUri.fsPath, 'activeTextEditor')
			const debugEditor = window.visibleTextEditors.find(e => e.document.uri.scheme == 'debugListing')
			assert.equal(debugEditor?.document.uri.fsPath, debugUri.fsPath, 'debugEditor')
			debugEditor!.selection = new Selection(40, 0, 30, 0)
			return sleep(25)
		})
		.then(() => sleep(100))
		.then(() => {
			const debugEditor = window.visibleTextEditors.find(e => e.document.uri.scheme == 'debugListing')
			assert.selection(debugEditor?.selection, [30, 0, 40, 0], debugEditor?.document.uri)
			assert.ok(debugEditor?.selection.isReversed, 'debugEditor selection should be reversed')

			const sourceEditor = window.visibleTextEditors.filter(e => e.document.uri.fsPath != debugUri.fsPath)
			assert.equal(sourceEditor.length, 1, 'should be only one source editor open')

			assert.equal(sourceEditor[0].document.uri.fsPath, sourceUri.fsPath, 'source editor should be the only other visible editor')
			assert.selection(sourceEditor[0].selection, [26, 0, 30, 0])
			return
		}, (e: unknown) => {
			log.error('Error in debugLines.8: ' + e)
			assert.fail('Error in debugLines.8: ' + e)
			throw e
		})
	return
})

test('debugLines.10 - Debug Listing Preview selection across files', () => {
	log.info('---------- start debugLines.10 ----------')
	const sourceUri = toUri('src/code/unit_test7.p')
	const debugUri = toUri('src/code/unit_test7.p Debug Listing')
	const includeUri = toUri('src/inc/include_7.i')

	return commands.executeCommand('workbench.action.closeAllEditors')
		.then(() => sleep(100))
		.then(() => {
			assert.equal(window.visibleTextEditors.length, 0, 'should be no visible editors before opening sourceUri')
			return commands.executeCommand('vscode.open', sourceUri)
		})
		.then(() => sleep(100))
		.then(() => {
			assert.equal(window.visibleTextEditors.length, 1, 'after vscode.open')
			assert.equal(window.activeTextEditor?.document.uri.fsPath, sourceUri.fsPath, 'activeTextEditor')
			return commands.executeCommand('ablunit.showDebugListingPreview')
		})
		.then(() => sleep(100))
		.then(() => {
			assert.equal(window.activeTextEditor?.document.uri.fsPath, sourceUri.fsPath, 'activeTextEditor')
			const debugEditor = window.visibleTextEditors.filter(e => e.document.uri.scheme == 'debugListing')
			assert.equal(debugEditor.length, 1, 'should be only one debug editor open')
			assert.equal(debugEditor[0].document.uri.fsPath, debugUri.fsPath, 'debugEditor')
			debugEditor[0].selection = new Selection(30, 0, 40, 0)
			return sleep(100)
		})
		.then(() => sleep(100))
		.then(() => {
			const debugEditor = window.visibleTextEditors.find(e => e.document.uri.scheme == 'debugListing')
			assert.selection(debugEditor?.selection, [30, 0, 40, 0], debugEditor?.document.uri)

			const includeEditor = window.visibleTextEditors.filter(e => e.document.uri.fsPath != debugEditor?.document.uri.fsPath)
			assert.equal(includeEditor.length, 1, 'should be only one source editor open')
			assert.equal(includeEditor[0].document.uri.fsPath, includeUri.fsPath, 'include editor should be the only other visible editor')
			assert.selection(includeEditor[0].selection, [0, 0, 6, 0])
			return
		}, (e: unknown) => {
			log.error('Error in debugLines.8: ' + e)
			assert.fail('Error in debugLines.8: ' + e)
			throw e
		})
	return
})
