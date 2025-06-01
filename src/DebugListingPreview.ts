import { commands, EventEmitter, ExtensionContext, Position, Range, Selection, TabInputText, TextDocumentContentProvider, TextEditor, TextEditorRevealType, TextEditorSelectionChangeKind, Uri, ViewColumn, window, workspace, WorkspaceFolder } from 'vscode'
import { ABLUnitConfig } from 'ABLUnitConfigWriter'
import { ABLDebugLines } from 'ABLDebugLines'
import { PropathParser } from 'ABLPropath'
import { getDLC, IDlc } from 'parse/OpenedgeProjectParser'
import { ablExec } from 'ABLExec'
import { log } from 'ChannelLogger'
import * as FileUtils from 'FileUtils'

export class DebugListingContentProvider implements TextDocumentContentProvider {

	private previewEditor: TextEditor | undefined = undefined
	private showDebugListingPreviewWorking = false
	private updatingSelection = false
	private updatingVisibleRanges = false
	private readonly debugListingUriMap = new Map<string, Uri>()
	private readonly sourceUriMap = new Map<string, Uri>() // entry[0] = sourceUri, others=includes
	private readonly includeMap: Map<TextEditor, string> = new Map<TextEditor, string>() // map include to the main source file
	private readonly cfg: Map<WorkspaceFolder, ABLUnitConfig> = new Map<WorkspaceFolder, ABLUnitConfig>()
	private readonly debugLinesMap: Map<WorkspaceFolder, ABLDebugLines> = new Map<WorkspaceFolder, ABLDebugLines>()
	private readonly onDidChangeEmitter = new EventEmitter<Uri>()
	onDidChange = this.onDidChangeEmitter.event

	constructor (context: ExtensionContext, private readonly contextResourcesUri: Uri) {
		context.subscriptions.push(
			commands.registerCommand('ablunit.showDebugListingPreview', async (uri: Uri | string | undefined) => {
				uri = uri ?? window.activeTextEditor?.document.uri
				if (typeof uri === 'string') {
					uri = Uri.parse(uri)
				}
				if (!uri) {
					log.warn('showDebugListingPreview command invoked without uri')
					return
				}
				if (uri.path.endsWith('.i')) {
					log.warn('showDebugListingPreview command invoked with .i file, skipping: ' + uri.fsPath)
					return
				}
				await this.showDebugListingPreview(uri, true, contextResourcesUri)
				if (window.activeTextEditor?.document.languageId == 'abl') {
					await this.updateDebugListingSelection(window.activeTextEditor)
				}
			}),
			window.onDidChangeActiveTextEditor(async (e) => {
				if (e?.document.languageId != 'abl'
					|| e.document.uri.fsPath + ' Debug Listing' == this.previewEditor?.document.uri.fsPath) {
					return
				}
				if (this.updatingSelection) {
					log.info('skip active editor change event while updating selection (uri=' + e?.document.uri.fsPath + ')')
				}
				if (!this.previewEditor) {
					await this.showDebugListingPreview(e, false, contextResourcesUri)
				}
			}),
			window.onDidChangeVisibleTextEditors(e => {
				if (!e.find(editor => editor.document.uri.scheme == 'debugListing')) {
					log.info('No debugListing editors visible, clearing previewEditor')
					this.previewEditor = undefined
					this.updatingSelection = false
					this.showDebugListingPreviewWorking = false
				}
			}),
			window.onDidChangeTextEditorSelection(async (e) => {
				if (!this.previewEditor || (e.textEditor.document.languageId != 'abl' && e.textEditor.document.uri.scheme != 'debugListing')) {
					return
				}
				if (this.updatingSelection) {
					log.info('skip selection change event while updating selection (uri=' + e.textEditor.document.uri.fsPath + ')')
					return
				}

				log.info('e.kind=' + e.kind)
				if (e.kind == TextEditorSelectionChangeKind.Command) {
					log.info('skip selection change event for command')
					return
				}
				if (e.textEditor != window.activeTextEditor) {
					log.info('skip selection change event for non-active editor')
					return
				}

				if (window.activeTextEditor?.document.uri != e.textEditor.document.uri) {
					// do nothing for non-active editor selection updates
					log.debug('skip inactive (uri=' + e.textEditor.document.uri.fsPath + ')')
					return
				}
				this.updatingSelection = true
				log.info('update selection for ' + e.textEditor.document.uri.fsPath)
				if (e.textEditor.document.languageId == 'abl') {
					log.info('100')
					await this.updateDebugListingSelection(e.textEditor)
					log.info('101')
					await this.updateDebugListingVisibleRanges(e.textEditor, e.textEditor.visibleRanges as Range[])
					log.info('102')
				}
				if (e.textEditor.document.uri.scheme == 'debugListing') {
					log.info('103')
					await this.updateSourceSelection(e.textEditor)
					log.info('104')
					await this.updateSourceVisibleRange(e.textEditor, e.textEditor.visibleRanges as Range[])
					log.info('105')
				}
				log.info('update selection done for ' + e.textEditor.document.uri.fsPath)
				this.updatingSelection = false
			}),
			window.onDidChangeTextEditorVisibleRanges(async (e) => {
				if (!this.previewEditor || (e.textEditor.document.languageId != 'abl' && e.textEditor.document.uri.scheme != 'debugListing')) {
					return
				}
				if (this.updatingSelection) {
					log.info('skip visible range event while updating selection (uri=' + e.textEditor.document.uri.fsPath + ')')
					return
				}
				if (window.activeTextEditor?.document.uri != e.textEditor.document.uri) {
					// do nothing for non-active editor selection updates
					log.debug('skip inactive (uri=' + e.textEditor.document.uri.fsPath + ')')
					return
				}
				if (this.updatingVisibleRanges) {
					log.warn('skip onDidChangeTextEditorVisibleRanges event while updating visible ranges (uri=' + e.textEditor.document.uri.fsPath + ')')
					return
				}
				log.info('update visible ranges for ' + e.textEditor.document.uri.fsPath)
				this.updatingVisibleRanges = true
				if (e.textEditor.document.languageId == 'abl') {
					await this.updateDebugListingVisibleRanges(e.textEditor, e.visibleRanges as Range[])
				} else if (e.textEditor.document.uri.scheme == 'debugListing') {
					await this.updateSourceVisibleRange(e.textEditor, e.visibleRanges as Range[])
				}
				log.info('update visible ranges done for ' + e.textEditor.document.uri.fsPath)
				this.updatingVisibleRanges = false
			}),
			workspace.onDidSaveTextDocument(async (e) => {
				if (!this.previewEditor || (e.languageId !== 'abl' && e.uri.scheme !== 'debugListing')) {
					return
				}
				if (this.updatingSelection) {
					log.info('skip onDidSaveTextDocument event while updating selection (uri=' + e.uri.fsPath + ')')
					return
				}
				return await this.showDebugListingPreview(e.uri, false, contextResourcesUri)
			}),
		)
	}

	provideTextDocumentContent (uri: Uri): string {
		const debugListingUri = this.debugListingUriMap.get(uri.fsPath)
		if (!debugListingUri) {
			throw new Error('debugListingUri not found for uri: ' + uri.toString())
		}
		return FileUtils.readFileSync(debugListingUri).toString()
	}

	async showDebugListingPreview (e: Uri | TextEditor, fromCommand: boolean, contextResourcesUri: Uri): Promise<boolean> {
		if (this.showDebugListingPreviewWorking || (!fromCommand && !this.previewEditor)) {
			return false
		}
		this.showDebugListingPreviewWorking = true

		try {
			const uri = e instanceof Uri? e : e.document.uri
			const wf = workspace.getWorkspaceFolder(uri)
			if (!wf) {
				log.warn('No workspace folder found for uri: ' + uri.fsPath)
				return false
			}
			const debugLines = this.getDebugLines(uri)
			const cfg = this.cfg.get(wf)

			if (!cfg) {
				log.warn('No ABLUnitConfig found for workspace folder: ' + wf.uri.fsPath)
				return false
			}

			if (!window.visibleTextEditors.some(e => e.document.uri.scheme === 'debugListing')) {
				this.previewEditor = undefined
			}
			if (!fromCommand && !this.previewEditor) {
				log.debug('showDebugListingPreview called from non-command context, but no debugListingPreviewEditor exists that requires a refresh')
				return true
			}

			const currentUri = window.activeTextEditor?.document.uri
			if (!currentUri) {
				throw new Error('No activeTextEditor found to get currentUri')
			}

			const fileinfo = debugLines.propath.search(currentUri)
			if (!fileinfo) {
				log.warn('debugLines.propath.search returned undefined for uri=' + currentUri.fsPath)
				return false
			}
			const debugListingUri = fileinfo.debugListingUri
			if (!debugListingUri) {
				return false
			}

			await this.generateDebugListing(cfg, getDLC(wf), contextResourcesUri, debugLines.propath, currentUri, debugListingUri)

			const debugListingText = FileUtils.readFileSync(debugListingUri).toString()
			if (!debugListingText || debugListingText.length < 1) {
				throw new Error('debugListingText is empty or undefined. Cannot open debug listing preview.')
			}

			const debugListingPreviewUri = currentUri.with({scheme: 'debugListing', path: uri.path + ' Debug Listing'})
			this.debugListingUriMap.set(debugListingPreviewUri.fsPath, debugListingUri)
			this.sourceUriMap.set(debugListingPreviewUri.fsPath, uri)

			if (!this.previewEditor || this.previewEditor.document.uri.fsPath !== debugListingPreviewUri.fsPath) {
				this.previewEditor = await window.showTextDocument(debugListingPreviewUri, {
					viewColumn: ViewColumn.Beside,
					preview: true,
					preserveFocus: true,
					// selection: window.activeTextEditor?.selection
				})
			}

			const fullRange = new Range(new Position(0, 0), new Position(this.previewEditor.document.lineCount, 0))
			await this.previewEditor.edit(editBuilder => {
				editBuilder.replace(fullRange, debugListingText)
			})

			this.onDidChangeEmitter.fire(debugListingPreviewUri)
			return true
		} catch (e: unknown) {
			log.error('showDebugListingPreview failed. e=' + e)
			throw e
		} finally {
			this.showDebugListingPreviewWorking = false
		}
	}

	getDebugLines (uri: Uri): ABLDebugLines {
		if (uri.scheme == 'debugListing') {
			const sourceUri = this.sourceUriMap.get(uri.fsPath)
			if (!sourceUri) {
				log.error('No sourceUri found for debugListing uri: ' + uri.fsPath)
				throw new Error('No sourceUri found for debugListing uri: ' + uri.fsPath)
			}
			uri = sourceUri
		}
		const wf = workspace.getWorkspaceFolder(uri)
		if (!wf) {
			log.info('No workspace folder found for uri: ' + uri.fsPath)
			throw new Error('No workspace folder found for uri: ' + uri.fsPath)
		}

		let cfg = this.cfg.get(wf)
		if (!cfg) {
			cfg = new ABLUnitConfig()
			cfg.setup(wf)
			this.cfg.set(wf, cfg)
		}

		if (!this.debugLinesMap.has(wf)) {
			const debugLines = new ABLDebugLines(cfg.readPropathFromJson(this.contextResourcesUri))
			this.debugLinesMap.set(wf, debugLines)
		}

		const debugLines = this.debugLinesMap.get(wf)
		if (!debugLines) {
			log.error('ABLDebugLines not instantiated for uri: ' + uri.fsPath)
			throw new Error('ABLDebugLines not instantiated for uri: ' + uri.fsPath)
		}
		return debugLines
	}

	async updateDebugListingSelection (e: TextEditor) {
		if (!this.previewEditor || e.document.languageId != 'abl') {
			log.warn('No previewEditor or not an ABL document: ' + e.document.uri.fsPath)
			return
		}

		log.info('200')
		const debugLines = this.getDebugLines(e.document.uri)
		log.info('201')

		let sourceUri: Uri | undefined = e.document.uri
		if (e.document.uri.path.endsWith('.i')) {
			log.info('202 is include')
			const debugEditor = this.includeMap.get(e)
			log.info('debugEditor=' + debugEditor)
			if (!debugEditor) {
				log.warn('No debugEditor found for include: ' + e.document.uri.fsPath)
				return
			}
			sourceUri = this.sourceUriMap.get(debugEditor)
			log.info('sourceUri=' + sourceUri?.fsPath)
			if (!sourceUri) {
				log.warn('No sourceUri found for include: ' + e.document.uri.fsPath)
			}
		} else {
			sourceUri = e.document.uri
		}
		log.info('sourceUri=' + sourceUri?.fsPath)
		if (!sourceUri) {
			log.warn('No sourceUri found for e.document.uri: ' + e.document.uri.fsPath)
			return
		}

		const mappedSelections: Selection[] = []
		for (const s of e.selections) {
			log.info('220 s.anchor=' + s.anchor.line + ',' + s.anchor.character + ' s.active=' + s.active.line + ',' + s.active.character)
			log.info('sourceUri=' + sourceUri.fsPath + ', e.document.uri=' + e.document.uri.fsPath)
			const sel: Selection = new Selection(
				await debugLines.getDebugListingPosition(e, sourceUri, s.anchor),
				await debugLines.getDebugListingPosition(e, sourceUri, s.active),
			)
			log.info('221 sel.anchor=' + sel.anchor.line + ',' + sel.anchor.character + ' sel.active=' + sel.active.line + ',' + sel.active.character)
			mappedSelections.push(sel)
		}

		log.info('222')
		if (mappedSelections.length === 1) {
			if (mappedSelections[0].isEmpty) {
				mappedSelections[0] = new Selection(
					new Position(mappedSelections[0].active.line, 0),
					new Position(mappedSelections[0].active.line + 1, 0),
				)
			}
		}
		log.info('223 mappedSelections=' + JSON.stringify(mappedSelections, null, 4))
		this.previewEditor.selections = mappedSelections
	}

	async updateSourceSelection (e: TextEditor) {
		const uri = this.sourceUriMap.get(e.document.uri.fsPath)
		if (!uri) {
		    log.warn('No sourceUri found for e.document.uri: ' + e.document.uri.fsPath)
		    return
		}
		const debugLines = this.getDebugLines(uri)
		let sourceEditor = window.visibleTextEditors.find(e => e.document.uri.fsPath == uri.fsPath)

		let sourceViewColumn = sourceEditor?.viewColumn
		if (!sourceViewColumn) {
			const tab = window.tabGroups.all.flatMap(tg => tg.tabs)
				.find(t => t.input && t.input instanceof TabInputText && t.input.uri.fsPath == uri.fsPath)
			if (tab && tab.input instanceof TabInputText) {
				sourceViewColumn = tab.group.viewColumn
			}
		}

		const sourceMap = await debugLines.getSourceMap(uri)
		log.info('sourceMap for ' + e.document.uri.fsPath + ' length=' + sourceMap?.items.length)

		const mapItem = sourceMap?.items.find(i => i.debugLine >= e.selection.anchor.line)
		log.info('mapItem=' + JSON.stringify(mapItem, null, 4))

		if (mapItem && mapItem?.sourceUri.fsPath !== sourceEditor?.document.uri.fsPath) {
			log.info('Should open new source editor for ' + mapItem.sourceUri.fsPath)

			const existingEditor = window.visibleTextEditors.find(e => e.document.uri.fsPath == mapItem.sourceUri.fsPath)
			if (existingEditor) {
				log.info('Found existing source editor for ' + mapItem.sourceUri.fsPath)
				sourceEditor = existingEditor
			} else {
				await window.showTextDocument(mapItem.sourceUri, { viewColumn: sourceViewColumn, preserveFocus: true })
				log.info('active editor after open: ' + window.activeTextEditor?.document.uri.fsPath)

				sourceEditor = window.visibleTextEditors.find(e => e.document.uri.fsPath == mapItem.sourceUri.fsPath)
				if (!sourceEditor) {
					log.warn('No source editor found after opening: ' + mapItem.sourceUri.fsPath)
					return
				}
				this.includeMap.set(sourceEditor, e.document.uri.fsPath)

				log.info('sourceEditor after open: ' + sourceEditor?.document.uri.fsPath)
			}
		}

		if (!sourceEditor) {
		    log.warn('No source editor found for uri: ' + uri.fsPath)
		    return
		}

		const mappedSelections: Selection[] = []
		for (const s of e.selections) {
			const debugListAnchor = await debugLines.getSourcePosition(uri, uri, s.anchor)
			const debugListActive = await debugLines.getSourcePosition(uri, uri, s.active)
		    mappedSelections.push(new Selection(debugListAnchor, debugListActive))
		}

		if (mappedSelections.length === 1 && mappedSelections[0].isEmpty) {
			// when only one empty selection is present select the whole line so it's easier to see
			mappedSelections[0] = new Selection(mappedSelections[0].start.line, 0, mappedSelections[0].start.line + 1, 0)
		}

		sourceEditor.selections = mappedSelections
	}

	async getRangeArrayInfo (e: TextEditor, sourceUri: Uri, visibleRange: Range[], activePosition: Position, debugLinesMethod: (e: TextEditor | Uri, s: Uri, p: Position) => Promise<Position>): Promise<[number, number, Position]> {
		let rangeUnion = visibleRange[0]
		let totalVisibleLines = 0
		let linesBeforeActive = 0
		let linesAfterActive = 0

		for (const range of visibleRange) {
			rangeUnion = range.union(rangeUnion)
			totalVisibleLines += range.end.line - range.start.line + 1
			if (range.start.isBefore(activePosition) && range.end.isBefore(activePosition)) {
				linesBeforeActive += range.end.line - range.start.line + 1
			} else if (range.start.isAfter(activePosition) && range.end.isAfter(activePosition)) {
				linesAfterActive += range.end.line - range.start.line + 1
			} else {
				// The active selection is within this range
				linesBeforeActive += activePosition.line - range.start.line
				linesAfterActive += range.end.line - activePosition.line + 1
			}
		}

		if (activePosition.line < rangeUnion.start.line) {
			// cursor is before the visible range
			activePosition = await debugLinesMethod(e, sourceUri, new Position(rangeUnion.start.line, 0))
			linesBeforeActive = 0
			linesAfterActive = totalVisibleLines
		} else if (activePosition.line > rangeUnion.end.line) {
			// cursor if after the visible range
			activePosition = await debugLinesMethod(e, sourceUri, new Position(rangeUnion.end.line, 0))
			linesBeforeActive = totalVisibleLines - 1
			linesAfterActive = 0
		} else {
			log.info('400 e.document.uri=' + e.document.uri.fsPath + ', sourceUri=' + sourceUri.fsPath + ', activePosition=' + activePosition.line)
			activePosition = await debugLinesMethod(e, sourceUri, activePosition)
		}

		return [ linesBeforeActive, linesAfterActive, activePosition ]
	}

	async updateDebugListingVisibleRanges (e: TextEditor, visibleRange: Range[]) {
		if (!this.previewEditor || e.document.languageId != 'abl') {
			return
		}
		const debugLines = this.getDebugLines(e.document.uri)

		let sourceUri: Uri | undefined = e.document.uri
		if (e.document.uri.path.endsWith('.i')) {
			log.info('updateDebugListingVisibleRanges called for include file: ' + e.document.uri.fsPath)
			const debugEditor = this.includeMap.get(e)
			if (!debugEditor) {
				log.warn('No debugEditor found for include: ' + e.document.uri.fsPath)
				return
			}
			sourceUri = this.sourceUriMap.get(debugEditor)
			if (!sourceUri) {
				log.warn('No sourceUri found for debugEditor: ' + debugEditor)
				return
			}
			log.info('sourceUri=' + sourceUri.fsPath)
		}


		const [ debugLinesBeforeActive, debugLinesAfterActive, activePosition ]
			= await this.getRangeArrayInfo(e, sourceUri, visibleRange, e.selection.active, (e: TextEditor | Uri, s: Uri, p: Position) => debugLines.getDebugListingPosition(e, s, p))

		// The math is correct for the range, but we have to add 3 additional lines for what
		// appears to be MAGIC in how VSCode chooses to reveal ranges.
		const range = new Range(
			activePosition.line - debugLinesBeforeActive + 3, 0,
			Math.min(activePosition.line + debugLinesAfterActive, this.previewEditor.document.lineCount), 0
		)

		this.previewEditor.revealRange(range, TextEditorRevealType.AtTop)
	}

	async updateSourceVisibleRange (e: TextEditor, visibleRange: Range[]) {
		if (!this.previewEditor || e.document.uri.scheme != 'debugListing') {
			return
		}
		log.info('300')
		const debugLines = this.getDebugLines(e.document.uri)
		log.info('301')
		const debugUri = this.previewEditor.document.uri.fsPath
		log.info('302')
		const sourceUri = this.sourceUriMap.get(debugUri)
		log.info('303.1 sourceUri=' + sourceUri?.fsPath)
		if (!sourceUri) {
			log.warn('No sourceUri found for debugUri: ' + debugUri)
			return
		}
		const sourceEditor = window.visibleTextEditors.find(e => e.document.uri.fsPath == sourceUri.fsPath)
		log.info('303.2 sourceEditor=' + sourceEditor?.document.uri.fsPath)
		// let sourceEditor = window.visibleTextEditors.find(e => e.document.uri.fsPath == this.sourceUriMap.get(debugUri)?.fsPath)
		// if (!sourceEditor) {
		// 	log.warn('No source editor found for debugUri: ' + debugUri)
		// 	return
		// }

		// const sourceMap = await debugLines.getSourceMap(e.document.uri)
		// log.info('sourceMap for ' + e.document.uri.fsPath + ' length=' + sourceMap?.items.length)
		// const mapItem = sourceMap?.items.find(i => i.debugLine === e.selection.anchor.line - 1)
		// log.info('mapItem=' + JSON.stringify(mapItem, null, 4))
		// if (mapItem && mapItem?.sourceUri.fsPath !== sourceEditor?.document.uri.fsPath) {
		// 	log.info('Should open new source editor for ' + mapItem.sourceUri.fsPath)

		// 	await commands.executeCommand('vscode.open', mapItem.sourceUri, { viewColumn: ViewColumn.Active, preserveFocus: true })
		// 	log.info('active editor after open: ' + window.activeTextEditor?.document.uri.fsPath)
		// 	sourceEditor = window.activeTextEditor
		// }

		if (!sourceEditor) {
			log.warn('No source editor found for debugUri: ' + debugUri)
			return
		}

		log.info('sourceEditor=' + sourceEditor.document.uri.fsPath)
		const [ sourceLinesBeforeActive, sourceLinesAfterActive, activePosition ]
			= await this.getRangeArrayInfo(e, sourceEditor.document.uri, visibleRange, e.selection.active, (e: TextEditor | Uri, s: Uri, p: Position) => debugLines.getSourcePosition(e, s, p))

		// The math is correct for the range, but we have to add 3 additional lines for what
		// appears to be MAGIC in how VSCode chooses to reveal ranges.
		const range = new Range(
			activePosition.line - sourceLinesBeforeActive + 3, 0,
			Math.min(activePosition.line + sourceLinesAfterActive, this.previewEditor.document.lineCount), 0
		)

		sourceEditor.revealRange(range, TextEditorRevealType.AtTop)
	}

	generateDebugListing (cfg: ABLUnitConfig, dlc: IDlc, contextResourcesUri: Uri, propath: PropathParser, currentUri: Uri, debugListingUri: Uri) {
		const env: Record<string, string> = {
			SOURCE_FILE: currentUri.fsPath,
			DEBUG_LISTING_PATH: debugListingUri.fsPath,
		}
		return ablExec(cfg, dlc, Uri.joinPath(contextResourcesUri, 'VSCodeTestRunner', 'VSCode', 'generateDebugListing.p').fsPath, propath, env)
	}
}

export function getDebugListingPreviewEditor (uri: Uri): TextEditor | undefined {
	return window.visibleTextEditors.find(editor =>
		editor.document.uri.scheme === 'debugListing'
		&& editor.document.uri.fsPath === uri.fsPath + ' Debug Listing')
}
