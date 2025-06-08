import { EventEmitter, ExtensionContext, Position, Range, Selection, TabChangeEvent, TabGroupChangeEvent, TextDocumentContentProvider, TextEditor, TextEditorRevealType, TextEditorSelectionChangeKind, Uri, ViewColumn, window, workspace, WorkspaceFolder } from 'vscode'
import { ABLUnitConfig } from 'ABLUnitConfigWriter'
import { ABLDebugLines } from 'ABLDebugLines'
import { PropathParser } from 'ABLPropath'
import { getDLC, IDlc } from 'parse/OpenedgeProjectParser'
import { ablExec } from 'ABLExec'
import { log } from 'ChannelLogger'
import * as FileUtils from 'FileUtils'

interface IRangeInfo {
	linesBeforeActive: number
	linesAfterActive: number
	activeUri: Uri
	activePosition: Position
}

export class DebugListingContentProvider implements TextDocumentContentProvider {
	private static instance: DebugListingContentProvider | undefined = undefined
	private previewEditor: TextEditor | undefined = undefined
	private showDebugListingPreviewProcessing = false
	private showTextDocumentProcessing = false
	private readonly selectionProcessed: string[] = []
	private readonly visibleRangeProcessed = new Map<string, number>()
	private readonly debugListingUriMap = new Map<string, Uri>()
	private readonly sourceUriMap = new Map<string, Uri>()
	private readonly cfg: Map<WorkspaceFolder, ABLUnitConfig> = new Map<WorkspaceFolder, ABLUnitConfig>()
	private readonly debugLinesMap: Map<WorkspaceFolder, ABLDebugLines> = new Map<WorkspaceFolder, ABLDebugLines>()
	private readonly onDidChangeEmitter = new EventEmitter<Uri>()
	onDidChange = this.onDidChangeEmitter.event

	constructor (context: ExtensionContext, private readonly contextResourcesUri: Uri) {
		context.subscriptions.push(
			window.onDidChangeActiveTextEditor(async (e) => {
				if (e?.document.languageId != 'abl') {
					return
				}
				if (e.document.uri.fsPath + ' Debug Listing' == this.previewEditor?.document.uri.fsPath) {
					return
				}
				log.debug('--- onDidChangeActiveTextEditor e.document.uri=' + e.document.uri.fsPath + ', languageId=' + e.document.languageId)
				await this.showDebugListingPreview(e, false, contextResourcesUri)
			}),
			window.tabGroups.onDidChangeTabGroups((_e: TabGroupChangeEvent) => {
				if (this.showTextDocumentProcessing) {
					return
				}
				this.setPreviewEditor(true)
			}),
			window.tabGroups.onDidChangeTabs((_e: TabChangeEvent) => {
				if (this.showTextDocumentProcessing) {
					return
				}
				this.setPreviewEditor(true)
			}),
			window.onDidChangeTextEditorSelection(async (e) => {
				if (this.showTextDocumentProcessing) {
					return
				}
				if (e.textEditor.document.languageId != 'abl' && e.textEditor.document.uri.scheme != 'debugListing') {
					return
				}
				log.debug('--- onDidChangeTextEditorSelection e.textEditor.document.uri=' + e.textEditor.document.uri.fsPath + ':' + e.selections[0].start.line + ':' + e.selections[0].start.character +
					'-' + e.selections[0].end.line + ':' + e.selections[0].end.character)
				if (!this.previewEditor) {
					return
				}
				if (e.textEditor.document.languageId != 'abl' && e.textEditor.document.uri.scheme != 'debugListing') {
					return
				}
				if (e.kind == TextEditorSelectionChangeKind.Command && this.selectionProcessed.includes(e.textEditor.document.uri.fsPath)) {
					log.debug('SKIP TextEditorSelectionChangeKind.Command and already processed (uri=' + e.textEditor.document.uri.fsPath + ')')
					while (this.selectionProcessed.includes(e.textEditor.document.uri.fsPath)) {
						this.selectionProcessed.splice(this.selectionProcessed.indexOf(e.textEditor.document.uri.fsPath))
					}
					return
				}

				if (e.textEditor.document.languageId == 'abl') {
					// TODO return instead of await --- but fix the sourceMap problems in the log file first
					await this.updateDebugListingSelection(e.textEditor)
						.then(() => this.updateDebugListingVisibleRanges(e.textEditor, e.textEditor.visibleRanges as Range[]))
				}
				if (e.textEditor.document.uri.scheme == 'debugListing') {
					await this.updateSourceSelection(e.textEditor)
						.then(() => this.updateSourceVisibleRanges(e.textEditor, e.textEditor.visibleRanges as Range[]))
				}
			}),
			window.onDidChangeTextEditorVisibleRanges((e) => {
				if (this.showTextDocumentProcessing) {
					return
				}
				if (e.textEditor.document.languageId != 'abl' && e.textEditor.document.uri.scheme != 'debugListing') {
					return
				}
				if (!this.previewEditor) {
					return
				}

				const lastSetTime = this.visibleRangeProcessed.get(e.textEditor.document.uri.fsPath)
				if (lastSetTime && (Date.now() - lastSetTime) < 1000) {
					return
				}
				log.debug('-- onDidChangeTextEditorVisibleRanges e.textEditor.document.uri=' + e.textEditor.document.uri.fsPath)

				if (e.textEditor.document.languageId == 'abl') {
					return this.updateDebugListingVisibleRanges(e.textEditor, e.visibleRanges as Range[])
				} else {
					return this.updateSourceVisibleRanges(e.textEditor, e.visibleRanges as Range[])
				}
			}),
			workspace.onDidSaveTextDocument(async (e) => {
				if (e.languageId != 'abl' || !this.previewEditor) {
					return
				}
				return await this.showDebugListingPreview(e.uri, false, contextResourcesUri)
			}),
		)
	}

	public static getInstance (context: ExtensionContext, contextResourcesUri: Uri) {
		DebugListingContentProvider.instance = DebugListingContentProvider.instance ?? new DebugListingContentProvider(context, contextResourcesUri)
		return DebugListingContentProvider.instance
	}

	private setPreviewEditor (force = false): void {
		log.debug('--- setPreviewEditor force=' + force + ', this.previewEditor=' + this.previewEditor?.document.uri.fsPath)
		if (!force && this.previewEditor) {
			return
		}
		this.previewEditor = window.visibleTextEditors.find(editor => editor.document.uri.scheme == 'debugListing')
		if (force) {
			this.showDebugListingPreviewProcessing = false
			this.selectionProcessed.length = 0
			this.visibleRangeProcessed.clear()
		}
		if (this.previewEditor) {
			return
		}
		log.debug('failed to sync previewEditor!')
		throw new Error('failed to sync previewEditor!')
	}

	private async getSourceUri (includeUri: Uri) {
		const sourceUri = this.sourceUriMap.get(includeUri.fsPath)
		if (sourceUri) {
			return sourceUri
		}
		if (this.previewEditor) {
			const sourceUri = this.sourceUriMap.get(this.previewEditor.document.uri.fsPath)
			if (sourceUri) {
				const debugLines = this.getDebugLines(sourceUri)
				const sourceMap = await debugLines.getSourceMap(sourceUri)
				if (sourceMap?.includes.find(i => i.sourceUri.fsPath == includeUri.fsPath)) {
					const includeMap = sourceMap?.includes.find(i => i.sourceUri.fsPath == includeUri.fsPath)
					if (includeMap) {
						log.debug('Include uri was not mapped but found in sourceMap: ' + JSON.stringify(includeMap))
						this.sourceUriMap.set(includeUri.fsPath, sourceUri)
						return sourceUri
					}
				}
			}
		}
		if (includeUri.path.endsWith('.i')) {
			log.error('No sourceUri found for includeUri: ' + includeUri.fsPath)
			throw new Error('No sourceUri found for includeUri: ' + includeUri.fsPath)
		}
		return includeUri
	}

	public provideTextDocumentContent (uri: Uri): string {
		const debugListingUri = this.debugListingUriMap.get(uri.fsPath)
		if (!debugListingUri) {
			log.error('debugListingUri not found for uri: ' + uri.toString())
			throw new Error('debugListingUri not found for uri: ' + uri.toString())
		}
		return FileUtils.readFileSync(debugListingUri).toString()
	}

	public async showDebugListingPreviewCommand (uri: Uri | string | undefined): Promise<void> {
		log.debug('--- showDebugListingPreviewCommand uri: ' + (typeof uri === 'string' ? uri : uri?.fsPath))
		uri = uri ?? window.activeTextEditor?.document.uri
		if (typeof uri === 'string') {
			uri = Uri.parse(uri)
		}
		if (!uri) {
			log.warn('showDebugListingPreview command invoked without uri')
			return
		}
		await this.showDebugListingPreview(uri, true, this.contextResourcesUri)
		if (window.activeTextEditor?.document.languageId == 'abl') {
			await this.updateDebugListingSelection(window.activeTextEditor)
		}
	}

	private async showDebugListingPreview (e: Uri | TextEditor, fromCommand: boolean, contextResourcesUri: Uri): Promise<boolean> {
		if (this.showDebugListingPreviewProcessing || (!fromCommand && !this.previewEditor)) {
			return false
		}
		const sourceUri = e instanceof Uri? e : e.document.uri
		if (sourceUri.path.endsWith('.i')) {
			log.debug('skipping showDebugListingPreview for include file: ' + sourceUri.fsPath)
			return false
		}
		log.debug('--- showDebugListingPreview e=' + (e instanceof Uri ? e.fsPath : e.document.uri.fsPath) + ', fromCommand=' + fromCommand)

		this.showDebugListingPreviewProcessing = true
		const wf = workspace.getWorkspaceFolder(sourceUri)
		if (!wf) {
			log.warn('No workspace folder found for uri: ' + sourceUri.fsPath)
			return false
		}
		this.sourceUriMap.clear()

		try {
			const debugLines = this.getDebugLines(sourceUri)
			const cfg = this.cfg.get(wf)!
			if (!fromCommand && !this.previewEditor) {
				log.debug('showDebugListingPreview called from non-command context, but no debugListingPreviewEditor exists that requires a refresh')
				return true
			}

			const fileinfo = debugLines.propath.search(sourceUri)
			if (!fileinfo) {
				log.warn('debugLines.propath.search returned undefined for uri=' + sourceUri.fsPath)
				return false
			}

			const debugListingUri = fileinfo.debugListingUri
			await this.generateDebugListing(cfg, getDLC(wf), contextResourcesUri, debugLines.propath, sourceUri, debugListingUri)

			const debugListingText = FileUtils.readFileSync(debugListingUri).toString()
			if (!debugListingText || debugListingText.length < 1) {
				throw new Error('debugListingText is empty or undefined. Cannot open debug listing preview.')
			}

			const debugListingPreviewUri = sourceUri.with({scheme: 'debugListing', path: sourceUri.path + ' Debug Listing'})
			this.debugListingUriMap.set(debugListingPreviewUri.fsPath, debugListingUri)
			this.sourceUriMap.set(debugListingPreviewUri.fsPath, sourceUri)

			if (!this.previewEditor || this.previewEditor.document.uri.fsPath !== debugListingPreviewUri.fsPath) {
				this.previewEditor = await window.showTextDocument(debugListingPreviewUri, {
					viewColumn: this.previewEditor?.viewColumn ?? ViewColumn.Beside,
					preview: true,
					preserveFocus: true,
				}).then(() => {
					return window.visibleTextEditors.find(editor => editor.document.uri.fsPath === debugListingPreviewUri.fsPath)
				})
				if (!this.previewEditor) {
					log.error('Failed to show debug listing preview for uri: ' + debugListingPreviewUri.fsPath)
					throw new Error('Failed to show debug listing preview for uri: ' + debugListingPreviewUri.fsPath)
				}
				this.sourceUriMap.set(this.previewEditor.document.uri.fsPath, sourceUri)
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
			this.showDebugListingPreviewProcessing = false
		}
	}

	private getDebugLines (uri: Uri): ABLDebugLines {
		const wf = workspace.getWorkspaceFolder(uri)
		if (!wf) {
			throw new Error('No workspace folder found for uri: ' + uri.fsPath)
		}

		let cfg = this.cfg.get(wf)
		if (!cfg) {
			cfg = new ABLUnitConfig()
			cfg.setup(wf, undefined, false)
			this.cfg.set(wf, cfg)
		}

		if (!this.debugLinesMap.has(wf)) {
			const debugLines = new ABLDebugLines(cfg.readPropathFromJson(this.contextResourcesUri))
			this.debugLinesMap.set(wf, debugLines)
		}

		const debugLines = this.debugLinesMap.get(wf)
		if (!debugLines) {
			throw new Error('ABLDebugLines not instantiated for uri: ' + uri.fsPath)
		}
		return debugLines
	}

	private async translateRange (editor: TextEditor,
							visibleRange: Range[],
							activePosition: Position,
							positionMethod: (source: Uri, include: TextEditor, p: Position) => Promise<{uri: Uri, position: Position}>
							): Promise<IRangeInfo> {
		log.debug('editor=' + editor.document.uri.fsPath + ', activePosition=' + activePosition.line + ':' + activePosition.character)
		let rangeUnion = visibleRange[0]
		let totalVisibleLines = 0
		let linesBeforeActive = 0
		let linesAfterActive = 0

		const includeUri = editor.document.uri
		const sourceUri = await this.getSourceUri(includeUri)

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

		let uriAndPosition: { uri: Uri, position: Position }
		if (activePosition.line < rangeUnion.start.line) {
			// cursor is before the visible range
			uriAndPosition = await positionMethod(sourceUri, editor, new Position(rangeUnion.start.line, 0))
			linesBeforeActive = 0
			linesAfterActive = totalVisibleLines
		} else if (activePosition.line > rangeUnion.end.line) {
			// cursor if after the visible range
			uriAndPosition = await positionMethod(sourceUri, editor, new Position(rangeUnion.end.line, 0))
			linesBeforeActive = totalVisibleLines - 1
			linesAfterActive = 0
		} else {
			uriAndPosition = await positionMethod(sourceUri, editor, activePosition)
		}

		return {
			linesBeforeActive,
			linesAfterActive,
			activeUri: uriAndPosition.uri,
			activePosition: uriAndPosition.position
		}
	}

	private async updateDebugListingSelection (e: TextEditor) {
		log.debug('--- updateDebugListingSelection e.document.uri=' + e.document.uri.fsPath + ', languageId=' + e.document.languageId)
		this.setPreviewEditor()

		const includeUri = e.document.uri
		const sourceUri = await this.getSourceUri(includeUri)
		const debugLines = this.getDebugLines(sourceUri)

		const mappedSelections: Selection[] = []
		for (const s of e.selections) {
			const sel: Selection = new Selection(
				(await debugLines.getDebugListingPosition(sourceUri, e, s.anchor)).position,
				(await debugLines.getDebugListingPosition(sourceUri, e, s.active)).position,
			)
			mappedSelections.push(sel)
		}

		if (mappedSelections.length === 1) {
			if (mappedSelections[0].isEmpty) {
				mappedSelections[0] = new Selection(
					new Position(mappedSelections[0].active.line, 0),
					new Position(mappedSelections[0].active.line + 1, 0),
				)
			}
		}

		log.debug('set selections:')
		for (const sel of mappedSelections) {
			log.debug('\t' + this.previewEditor!.document.uri.fsPath + ':' + sel.start.line + ':' + sel.end.line)
		}
		this.selectionProcessed.push(this.previewEditor!.document.uri.fsPath)
		log.debug('set selections for ' + this.previewEditor!.document.uri.fsPath + ' to ' + mappedSelections.map(s => s.start.line + ':' + s.end.line).join(', '))
		this.previewEditor!.selections = mappedSelections
	}

	private async updateDebugListingVisibleRanges (editor: TextEditor, visibleRange: Range[]) {
		log.debug('--- updateDebugListingVisibleRanges editor=' + editor.document.uri.fsPath + ', visibleRange=' + visibleRange.map(r => r.start.line + ':' + r.end.line).join(', '))
		this.setPreviewEditor()

		const includeUri = editor.document.uri
		const sourceUri = await this.getSourceUri(includeUri)
		const debugLines = this.getDebugLines(sourceUri)

		const rangeInfo = await this.translateRange(
				editor,
				visibleRange,
				editor.selection.active,
				(source: Uri, include: TextEditor, p: Position) => debugLines.getDebugListingPosition(source, include, p))

		// The math is correct for the range, but we have to add 3 additional lines for what
		// appears to be MAGIC in how VSCode chooses to reveal ranges.
		const range = new Range(
			rangeInfo.activePosition.line - rangeInfo.linesBeforeActive + 3, 0,
			Math.min(rangeInfo.activePosition.line + rangeInfo.linesAfterActive, this.previewEditor!.document.lineCount), 0
		)

		this.visibleRangeProcessed.set(this.previewEditor!.document.uri.fsPath, Date.now())
		log.debug('revealRange=' + this.previewEditor!.document.uri.fsPath + ':' + range.start.line + ':' + range.end.line)
		this.previewEditor!.revealRange(range, TextEditorRevealType.AtTop)
	}

	private async updateSourceSelection (e: TextEditor) {
		log.debug('--- updateSourceSelection e.document.uri=' + e.document.uri.fsPath + ', languageId=' + e.document.languageId)
		this.previewEditor = e

		const debugListingUri = e.document.uri
		const sourceUri = await this.getSourceUri(debugListingUri)
		if (!sourceUri) {
		    log.warn('No sourceUri found for e.document.uri: ' + e.document.uri.fsPath)
		    return
		}

		const debugLines = this.getDebugLines(sourceUri)
		const mappedSelections: {uri: Uri, selection: Selection}[] = []
		const activeSelection = await debugLines.getSourcePosition(sourceUri, e.selection.active)

		for (const s of e.selections) {
			let debugListAnchor = await debugLines.getSourcePosition(sourceUri, s.anchor)
			const debugListActive = await debugLines.getSourcePosition(sourceUri, s.active)
			if (debugListAnchor.uri.fsPath !== debugListActive.uri.fsPath) {

				const map = await debugLines.getSourceMap(sourceUri)
				const includeItem = map?.includes.find(i => i.sourceUri.fsPath == debugListAnchor.uri.fsPath)

				if (includeItem) {
					if (debugListActive.uri.fsPath == sourceUri.fsPath) {
						const includeItem2 = map?.includes[map?.includes.indexOf(includeItem) + 1]
						if (includeItem2) {
							if ((includeItem2.sourceLine - 1) < 0) {
								log.error('includeItem2.sourceLine is less than 0: ' + includeItem2.sourceLine)
								throw new Error('includeItem2.sourceLine is less than 0: ' + includeItem2.sourceLine)
							}
							debugListAnchor = {
								uri: debugListActive.uri,
								position: new Position(includeItem2.sourceLine - 1, 0)
							}
						}
					} else {
						debugListAnchor = {
							uri: debugListActive.uri,
							position: new Position(0, 0)
						}
						if (s.isReversed) {
							const includeEditor = window.visibleTextEditors.find(e => e.document.uri.fsPath == includeItem.debugUri.fsPath)
							if (includeEditor) {
								debugListAnchor.position = new Position(includeEditor.document.lineCount, 0)
							} else {
								log.warn('Unable to find TextEditor for includeItem.debugUri: ' + includeItem.debugUri.fsPath)
								debugListAnchor.position = new Position(includeItem.sourceLine + 1, 0)
							}
						}
					}
				}
			}

			log.debug('mapSelection: ' + debugListAnchor.uri.fsPath + ':' + debugListAnchor.position.line + '-' + debugListActive.uri.fsPath + ':' + debugListActive.position.line)
			mappedSelections.push({
				uri: debugListActive.uri,
				selection: new Selection(debugListAnchor.position, debugListActive.position)
			})
		}

		if (mappedSelections.length === 1 && mappedSelections[0].selection.isEmpty) {
			// when only one empty selection is present select the whole line so it's easier to see
			mappedSelections[0] = {
				uri: mappedSelections[0].uri,
				selection: new Selection(mappedSelections[0].selection.start.line, 0, mappedSelections[0].selection.start.line + 1, 0)
			}
		}

		const activeSelections = mappedSelections.filter(s => s.uri.fsPath == activeSelection.uri.fsPath)

		let includeOrSourceEditor = window.visibleTextEditors.find(e => e.document.uri.fsPath == activeSelection.uri.fsPath)
		if (!includeOrSourceEditor) {
			log.debug('show TextDocument for ' + activeSelection.uri.fsPath + ':' + activeSelections[0].selection.start.line + ':' + activeSelections[0].selection.end.line)
			this.showTextDocumentProcessing = true
			let vc = (this.previewEditor?.viewColumn ?? 2) - 1

			if (vc > 1 &&  vc == Number(window.visibleTextEditors.find(e => e.document.uri.scheme == 'debugListing')?.viewColumn)) {
				vc = vc - 1
			}
			includeOrSourceEditor = await window.showTextDocument(activeSelection.uri, { viewColumn: vc, preserveFocus: true, selection: activeSelections[0].selection  })
				.then(() => {
					this.showTextDocumentProcessing = false
					this.setPreviewEditor(true)
					return window.visibleTextEditors.find(e => e.document.uri.fsPath == activeSelection.uri.fsPath)
				})
			if (!includeOrSourceEditor) {
				log.error('Failed showing TextDocument for ' + activeSelection.uri.fsPath)
				throw new Error('Failed showing TextDocument for ' + activeSelection.uri.fsPath)
			}
		}

		if (JSON.stringify(includeOrSourceEditor.selections) == JSON.stringify(activeSelections.map(m => m.selection))) {
			log.debug('Selections are already set for ' + includeOrSourceEditor.document.uri.fsPath)
		} else {
			log.debug('set active selections ' + includeOrSourceEditor.document.uri.fsPath + ' to ' + activeSelections.map(s => s.selection.start.line + ':' + s.selection.end.line).join(', '))
			this.selectionProcessed.push(includeOrSourceEditor.document.uri.fsPath)
			includeOrSourceEditor.selections = activeSelections.map(m => m.selection)
		}

		const inactiveSelections = mappedSelections.filter(s => s.uri.fsPath != activeSelection.uri.fsPath)
		for (const sel of inactiveSelections) {
			const visibleEditor = window.visibleTextEditors.find(e => e.document.uri.fsPath == sel.uri.fsPath)
			if (visibleEditor) {
				this.selectionProcessed.push(visibleEditor.document.uri.fsPath)
				visibleEditor.selections = inactiveSelections.filter(s => s.uri.fsPath == sel.uri.fsPath).map(m => m.selection)
				log.debug('set inactive selections 2 ' + visibleEditor.document.uri.fsPath + ' to ' + visibleEditor.selections.map(s => s.start.line + ':' + s.end.line).join(', '))
			}
		}
	}

	private async updateSourceVisibleRanges (e: TextEditor, visibleRange: Range[]) {
		log.debug('--- updateSourceVisibleRange e.document.uri=' + e.document.uri.fsPath + ', languageId=' + e.document.languageId)
		this.previewEditor = e

		const debugListingUri = e.document.uri
		const sourceUri = await this.getSourceUri(debugListingUri)
		const debugLines = this.getDebugLines(sourceUri)
		const rangeInfo = await this.translateRange(e, visibleRange, e.selection.active, (debugListing: TextEditor | Uri, _u: TextEditor | Uri | undefined, p: Position) => debugLines.getSourcePositionWrapper(debugListing, undefined, p))

		// The math is correct for the range, but we have to add 6 additional lines for what
		// appears to be MAGIC in how VSCode chooses to reveal ranges.
		let startLine = rangeInfo.activePosition.line - rangeInfo.linesBeforeActive + 6
		if (startLine < 0) {
			log.debug('start line is less than 0: ' + startLine)
			startLine = 0
		}
		let endLine = Math.min(rangeInfo.activePosition.line + rangeInfo.linesAfterActive, this.previewEditor.document.lineCount)
		if (endLine < 0) {
			log.debug('end line is less than 0: ' + endLine)
			endLine = 0
		}

		const range = new Range(
			startLine, 0,
			endLine, 0
		)
		const includeOrSourceEditor = window.visibleTextEditors.find(e => e.document.uri.fsPath == rangeInfo.activeUri.fsPath)
		if (!includeOrSourceEditor) {
			return
		}

		log.debug('revealRange ' + includeOrSourceEditor.document.uri.fsPath + ':' + range.start.line + ':' + range.end.line)
		this.visibleRangeProcessed.set(includeOrSourceEditor.document.uri.fsPath, Date.now())
		includeOrSourceEditor.revealRange(range, TextEditorRevealType.AtTop)
	}

	private generateDebugListing (cfg: ABLUnitConfig, dlc: IDlc, contextResourcesUri: Uri, propath: PropathParser, currentUri: Uri, debugListingUri: Uri) {
		log.debug('--- generateDebugListing currentUri=' + currentUri.fsPath + ', debugListingUri=' + debugListingUri.fsPath)
		const env: Record<string, string> = {
			SOURCE_FILE: currentUri.fsPath,
			DEBUG_LISTING_FILE: debugListingUri.fsPath,
		}

		cfg.createDbConnPf()
		return ablExec(cfg, dlc, Uri.joinPath(contextResourcesUri, 'VSCodeTestRunner', 'VSCode', 'generateDebugListing.p').fsPath, propath, env)
	}
}

export function getDebugListingPreviewEditor (uri: Uri): TextEditor | undefined {
	return window.visibleTextEditors.find(editor =>
		editor.document.uri.scheme === 'debugListing'
		&& editor.document.uri.fsPath === uri.fsPath + ' Debug Listing')
}
