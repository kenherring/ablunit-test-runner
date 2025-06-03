import { EventEmitter, ExtensionContext, Position, Range, Selection, TextDocumentContentProvider, TextEditor, TextEditorRevealType, Uri, ViewColumn, window, workspace, WorkspaceFolder } from 'vscode'
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
	private readonly debugListingUriMap = new Map<string, Uri>()
	private readonly sourceUriMap = new Map<string, Uri>()
	private readonly cfg: Map<WorkspaceFolder, ABLUnitConfig> = new Map<WorkspaceFolder, ABLUnitConfig>()
	private readonly debugLinesMap: Map<WorkspaceFolder, ABLDebugLines> = new Map<WorkspaceFolder, ABLDebugLines>()
	private readonly onDidChangeEmitter = new EventEmitter<Uri>()
	onDidChange = this.onDidChangeEmitter.event

	constructor (context: ExtensionContext, private readonly contextResourcesUri: Uri) {
		context.subscriptions.push(
			window.onDidChangeActiveTextEditor(async (e) => {
				if (e?.document.languageId != 'abl'
					|| e.document.uri.fsPath + ' Debug Listing' == this.previewEditor?.document.uri.fsPath) {
					return
				}
				return await this.showDebugListingPreview(e, false, contextResourcesUri)
			}),
			window.onDidChangeVisibleTextEditors(e => {
				if (!e.find(editor => editor.document.uri.scheme == 'debugListing')) {
					this.previewEditor = undefined
				}
			}),
			window.onDidChangeTextEditorSelection(async (e) => {
				if (e.textEditor.document.languageId != 'abl' && e.textEditor.document.uri.scheme != 'debugListing') {
					return
				}
				if (window.activeTextEditor?.document.uri != e.textEditor.document.uri) {
					// do nothing for non-active editor selection updates
					log.debug('skip inactive (uri=' + e.textEditor.document.uri.fsPath + ')')
					return
				}
				if (e.textEditor.document.languageId == 'abl') {
					await this.updateDebugListingSelection(e.textEditor)
					await this.updateDebugListingVisibleRanges(e.textEditor, e.textEditor.visibleRanges as Range[])
				}
				if (e.textEditor.document.uri.scheme == 'debugListing') {
					await this.updateSourceSelection(e.textEditor)
				}
			}),
			window.onDidChangeTextEditorVisibleRanges(async (e) => {
				if (e.textEditor.document.languageId != 'abl' && e.textEditor.document.uri.scheme != 'debugListing') {
					return
				}
				if (window.activeTextEditor?.document.uri != e.textEditor.document.uri) {
					// do nothing for non-active editor selection updates
					log.debug('skip inactive (uri=' + e.textEditor.document.uri.fsPath + ')')
					return
				}
				if (e.textEditor.document.languageId == 'abl') {
					await this.updateDebugListingVisibleRanges(e.textEditor, e.visibleRanges as Range[])
				} else if (e.textEditor.document.uri.scheme == 'debugListing') {
					await this.updateSourceVisibleRange(e.textEditor, e.visibleRanges as Range[])
				}
			}),
			workspace.onDidSaveTextDocument(async (e) => {
				if (e.languageId !== 'abl') {
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

	async showDebugListingPreviewCommand (uri: Uri | string | undefined): Promise<void> {
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
		const wf = workspace.getWorkspaceFolder(uri)
		if (!wf) {
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
			throw new Error('ABLDebugLines not instantiated for uri: ' + uri.fsPath)
		}
		return debugLines
	}

	async updateDebugListingSelection (e: TextEditor) {
		if (!this.previewEditor || e.document.languageId != 'abl') {
			return
		}

		const debugLines = this.getDebugLines(e.document.uri)

		const mappedSelections: Selection[] = []
		for (const s of e.selections) {
			const sel: Selection = new Selection(
				await debugLines.getDebugListingPosition(e, s.anchor),
				await debugLines.getDebugListingPosition(e, s.active),
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
		this.previewEditor.selections = mappedSelections
	}

	async updateSourceSelection (e: TextEditor) {
		const uri = this.sourceUriMap.get(e.document.uri.fsPath)
		if (!uri) {
		    log.warn('No sourceUri found for e.document.uri: ' + e.document.uri.fsPath)
		    return
		}

		const sourceEditor = window.visibleTextEditors.find(e => e.document.uri.fsPath == uri.fsPath)
		if (!sourceEditor) {
		    log.warn('No source editor found for uri: ' + uri.fsPath)
		    return
		}

		const debugLines = this.getDebugLines(uri)

		const mappedSelections: Selection[] = []
		for (const s of e.selections) {
			const debugListAnchor = await debugLines.getSourcePosition(uri, s.anchor)
			const debugListActive = await debugLines.getSourcePosition(uri, s.active)
		    mappedSelections.push(new Selection(debugListAnchor, debugListActive))
		}

		if (mappedSelections.length === 1 && mappedSelections[0].isEmpty) {
			// when only one empty selection is present select the whole line so it's easier to see
			mappedSelections[0] = new Selection(mappedSelections[0].start.line, 0, mappedSelections[0].start.line + 1, 0)
		}

		sourceEditor.selections = mappedSelections
	}

	async getRangeArrayInfo (editor: TextEditor, visibleRange: Range[], activePosition: Position, debugLinesMethod: (e: TextEditor | Uri, p: Position) => Promise<Position>): Promise<[number, number, Position]> {
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
			activePosition = await debugLinesMethod(editor, new Position(rangeUnion.start.line, 0))
			linesBeforeActive = 0
			linesAfterActive = totalVisibleLines
		} else if (activePosition.line > rangeUnion.end.line) {
			// cursor if after the visible range
			activePosition = await debugLinesMethod(editor, new Position(rangeUnion.end.line, 0))
			linesBeforeActive = totalVisibleLines - 1
			linesAfterActive = 0
		} else {
			activePosition = await debugLinesMethod(editor, activePosition)
		}

		return [ linesBeforeActive, linesAfterActive, activePosition ]
	}

	async updateDebugListingVisibleRanges (editor: TextEditor, visibleRange: Range[]) {
		if (!this.previewEditor || editor.document.languageId != 'abl') {
			return
		}
		const debugLines = this.getDebugLines(editor.document.uri)

		const [ debugLinesBeforeActive, debugLinesAfterActive, activePosition ]
			= await this.getRangeArrayInfo(editor, visibleRange, editor.selection.active, (e: TextEditor | Uri, p: Position) => debugLines.getDebugListingPosition(e, p))

		// The math is correct for the range, but we have to add 3 additional lines for what
		// appears to be MAGIC in how VSCode chooses to reveal ranges.
		const range = new Range(
			activePosition.line - debugLinesBeforeActive + 3, 0,
			Math.min(activePosition.line + debugLinesAfterActive, this.previewEditor.document.lineCount), 0
		)

		this.previewEditor.revealRange(range, TextEditorRevealType.AtTop)
	}

	async updateSourceVisibleRange (editor: TextEditor, visibleRange: Range[]) {
		if (!this.previewEditor || editor.document.languageId != 'debugListing') {
			return
		}
		const debugLines = this.getDebugLines(editor.document.uri)
		const debugUri = this.previewEditor.document.uri.fsPath
		const sourceEditor = window.visibleTextEditors.find(e => e.document.uri.fsPath == this.sourceUriMap.get(debugUri)?.fsPath)
		if (!sourceEditor) {
			log.warn('No source editor found for debugUri: ' + debugUri)
			return
		}

		const [ sourceLinesBeforeActive, sourceLinesAfterActive, activePosition ]
			= await this.getRangeArrayInfo(editor, visibleRange, editor.selection.active, (e: TextEditor | Uri, p: Position) => debugLines.getSourcePosition(e, p))

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
