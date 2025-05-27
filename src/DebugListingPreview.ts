import { ABLUnitConfig } from 'ABLUnitConfigWriter'
import { log } from 'ChannelLogger'
import { commands, EventEmitter, ExtensionContext, Position, Range, Selection, TextDocumentContentProvider, TextEditor, TextEditorRevealType, Uri, ViewColumn, window, workspace, WorkspaceFolder } from 'vscode'
import { FileUtils } from '../test/testCommon'
import { ABLDebugLines } from 'ABLDebugLines'
import { PropathParser } from 'ABLPropath'
import { getDLC, IDlc } from 'parse/OpenedgeProjectParser'
import { ablExec } from 'ABLExec'

export class DebugListingContentProvider implements TextDocumentContentProvider {

    private previewEditor: TextEditor | undefined = undefined
    private showDebugListingPreviewWorking = false
    private readonly debugListingUriMap = new Map<string, Uri>()
    private readonly sourceUriMap = new Map<string, Uri>()
    readonly onDidChangeEmitter = new EventEmitter<Uri>()
    onDidChange = this.onDidChangeEmitter.event
    private readonly cfg: Map<WorkspaceFolder, ABLUnitConfig> = new Map<WorkspaceFolder, ABLUnitConfig>()
    private readonly debugLinesMap: Map<WorkspaceFolder, ABLDebugLines> = new Map<WorkspaceFolder, ABLDebugLines>()

    constructor (context: ExtensionContext, contextResourcesUri: Uri) {

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
                log.info('showDebugListingPreview command invoked with uri: ' + uri.fsPath)
                await this.showDebugListingPreview(uri, true, contextResourcesUri)
                if (window.activeTextEditor?.document.languageId == 'abl') {
                    await this.updateDebugListingSelection(window.activeTextEditor)
                }
            }),
            window.onDidChangeActiveTextEditor(async (e) => {
                if (e?.document.languageId != 'abl') {
                    return
                }
                log.info('onDidChangeActiveTextEditor ' + e?.document.uri.fsPath)
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
                    await this.updateDebugListingSelection(e.textEditor)
                }
                if (e.textEditor.document.uri.scheme == 'debugListing') {
                    await this.updateSourceSelection(e.textEditor)
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
        const content = FileUtils.readFileSync(debugListingUri).toString()
        return content
    }

    async showDebugListingPreview (e: Uri | string | TextEditor | undefined, fromCommand: boolean, contextResourcesUri: Uri): Promise<boolean> {
        if (!e || this.showDebugListingPreviewWorking) {
            return false
        }
        if (!fromCommand && !this.previewEditor) {
            return false
        }

        log.info('---------- showDebugListingPreview called ---------- (showDebugListingPreviewWorking=' + this.showDebugListingPreviewWorking + ')')
        this.showDebugListingPreviewWorking = true

        try {
            if (!e) {
                return false
            }

            let uri: Uri | undefined = undefined
            if (typeof e === 'string') {
                uri = Uri.parse(e)
            } else if (e instanceof Uri) {
                uri = e
            } else {
                if (!e.document) {
                    return true
                }
                // if (e.document.languageId !== 'abl') {
                //     log.warn('showDebugListingPreview called with non-ABL document, ignoring: ' + e.document.uri?.fsPath)
                //     return true
                // }
                uri = e.document.uri
            }
            if (!uri) {
                throw new Error('showDebugListingPreview could not determine uri')
            }

            const wf = workspace.getWorkspaceFolder(uri)
            if (!wf) {
                throw new Error('No workspace folder found for uri: ' + uri.fsPath)
            }

            const debugLines = this.getDebugLines(uri)
            const propath = debugLines.propath
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
            const currentSelection = window.activeTextEditor?.selection

            if (!currentUri) {
                throw new Error('No activeTextEditor found to get currentUri')
            }

            const debugListingUri = debugLines.propath.search(currentUri)?.debugListingUri
            if (!debugListingUri) {
                log.warn('debugLines.propath.search returned undefined for uri=' + currentUri.fsPath)
                return false
            }

            await this.generateDebugListing(cfg, getDLC(wf), contextResourcesUri, propath, currentUri, debugListingUri)

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
                    selection: currentSelection
                })
            }

            const fullRange = new Range(new Position(0, 0), new Position(this.previewEditor.document.lineCount, 0))
            await this.previewEditor.edit(editBuilder => {
                editBuilder.replace(fullRange, debugListingText)
            })
            log.info('debugListingPreviewEditor.edit complete (debugListingText.length=' + debugListingText.length + ')')
            this.onDidChangeEmitter.fire(debugListingPreviewUri)
            return true
        } catch (e: unknown) {
            log.error('showDebugListingPreview failed. e=' + e)
            throw e
        } finally {
            this.showDebugListingPreviewWorking = false
            log.info('---------- showDebugListingPreview complete ---------- (showDebugListingPreviewWorking=' + this.showDebugListingPreviewWorking + ')')
        }
    }

    getDebugLines (uri: Uri): ABLDebugLines {
        const wf = workspace.getWorkspaceFolder(uri)
        if (!wf) {
            throw new Error('No workspace folder found for uri: ' + uri.fsPath)
        }
        if (!this.cfg.has(wf)) {
            const cfg = new ABLUnitConfig()
            cfg.setup(wf)
            this.cfg.set(wf, cfg)
        }
        if (!this.debugLinesMap.has(wf)) {
            const debugLines = new ABLDebugLines(this.cfg.get(wf)?.readPropathFromJson(Uri.joinPath(Uri.file(wf.uri.fsPath), 'resources')))
            this.debugLinesMap.set(wf, debugLines)
        }

        const debugLines = this.debugLinesMap.get(wf)
        if (!debugLines) {
            throw new Error('No debugLines found for uri: ' + uri.fsPath)
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
            // log.info('s.start.line=' + s.start.line + ', s.end.line=' + s.end.line)
            const sel: Selection = new Selection(
                await debugLines.getDebugListingPosition(e, s.start),
                await debugLines.getDebugListingPosition(e, s.end),
            )
            mappedSelections.push(sel)
        }

        if (mappedSelections.length === 1) {
            if (mappedSelections[0].isEmpty) {
                mappedSelections[0] = new Selection(
                    new Position(mappedSelections[0].start.line, 0),
                    new Position(mappedSelections[0].start.line + 1, 0),
                )
            }
        }

        const anchor = await debugLines.getDebugListingPosition(e, e.selection.anchor)
        const lineCountToAnchor = e.selection.anchor.line - e.visibleRanges[0].start.line
        const lineCountFromAnchor = e.visibleRanges[0].end.line - e.selection.anchor.line + (e.visibleRanges[0].end.line - e.visibleRanges[0].start.line + this.previewEditor.visibleRanges[0].start.line - e.visibleRanges[0].end.line)

        const range = new Range(anchor.line - lineCountToAnchor, 0, anchor.line + lineCountFromAnchor, 0)
        this.previewEditor.revealRange(range, TextEditorRevealType.AtTop)
        this.previewEditor.selections = mappedSelections
    }

    async updateSourceSelection (e: TextEditor) {
        // log.info('sourceUriMap.get(' + e.document.uri.fsPath +')')
        const uri = this.sourceUriMap.get(e.document.uri.fsPath)
        if (!uri) {
            log.warn('No debugListingUri found for e.document.uri: ' + e.document.uri.fsPath)
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
            // log.info('s.start.line=' + s.start.line + ', s.end.line=' + s.end.line)
            const sel: Selection = new Selection(
                await debugLines.getSourcePosition(uri, s.start),
                await debugLines.getSourcePosition(uri, s.end),
            )
            mappedSelections.push(sel)
        }

        if (mappedSelections.length === 1) {
            if (mappedSelections[0].isEmpty) {
                mappedSelections[0] = new Selection(
                    new Position(mappedSelections[0].start.line, 0),
                    new Position(mappedSelections[0].start.line + 1, 0),
                )
            }
        }

        sourceEditor.revealRange(mappedSelections[0], TextEditorRevealType.AtTop)
        sourceEditor.selections = mappedSelections
    }

    generateDebugListing (cfg: ABLUnitConfig, dlc: IDlc, contextResourcesUri: Uri, propath: PropathParser, currentUri: Uri, debugListingUri: Uri) {
        const env: Record<string, string> = {
            SOURCE_FILE: currentUri.fsPath,
            DEBUG_LISTING_PATH: debugListingUri.fsPath,
        }
        return ablExec(cfg, dlc, Uri.joinPath(contextResourcesUri, 'VSCodeTestRunner', 'generateDebugListing.p').fsPath, propath, env)
    }

}
