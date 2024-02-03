import { existsSync } from 'fs'
import { CancellationToken, DecorationOptions, FileCoverage, FileDecoration, FileDecorationProvider, ProviderResult, Range, TextDocument, TextEditor, TextEditorDecorationType, Uri, window, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { log } from './ChannelLogger'

interface IExecLines {
	count?: number,
	executed?: DecorationOptions[]
	executable?: DecorationOptions[]
}

export class Decorator {
	// static instance
	private static readonly _instance = new Decorator()
	private static instCount = 0
	static get instance () { Decorator.instCount++; return this._instance }

	private readonly backgroundExecutable: TextEditorDecorationType
	private readonly backgroundExecuted: TextEditorDecorationType
	private readonly instanceCount: number
	private decorateCount = 0
	private recentCoverage: Map<string, FileCoverage> = new Map<string, FileCoverage>
	private recentDecorations: Map<string, IExecLines> = new Map<string, IExecLines>

	private constructor () {
		this.instanceCount = Decorator.instCount
		log.info('Decorator constructor instanceCount=' + this.instanceCount + ' ' + Decorator.instCount)
		this.backgroundExecutable = window.createTextEditorDecorationType({
			backgroundColor: 'rgba(255,0,0,0.1)',
			isWholeLine: true,
			overviewRulerColor: 'rgba(255,0,0,0.5)', // todo
		})
		this.backgroundExecuted = window.createTextEditorDecorationType({
			backgroundColor: 'rgba(0,255,0,0.1)'
		})
	}

	removeFromVisible () {
		this.recentDecorations = new Map<string, IExecLines>()
		for (const e of window.visibleTextEditors) {
			this.remove(e)
		}
	}

	remove (e: TextEditor) {
		// log.debug('removing decorations from ' + e.document.uri.fsPath)
		e.setDecorations(this.backgroundExecutable, [])
		e.setDecorations(this.backgroundExecuted, [])
	}

	setRecentResults (results: ABLResults[] | undefined) {
		this.recentCoverage = new Map<string, FileCoverage>
		this.recentDecorations = new Map<string, IExecLines>
		const recentResults = results
		if (!recentResults) {
			return
		}

		let covCount = 0
		for (const r of recentResults) {
			for (const [k, v] of r.testCoverage) {
				if (existsSync(k)) {
					const uri = Uri.file(k)
					// log.debug('recentCoverage.set ' + uri.fsPath + ', detailedCoverage.length=' + v.detailedCoverage.length)
					this.recentCoverage.set(uri.fsPath, v)
					covCount++
				}
			}
		}
		log.info('setRecentResults-11 covCount=' + covCount)
		// TODO - decorate active editors?
		// this.decorate(window.activeTextEditor)
	}

	getRecentCoverage () {
		return this.recentCoverage
	}

	decorate (editor?: TextEditor, document?: TextDocument, uri?: Uri) {
		if (editor) {
			return this.decorateEditor(editor)
		}
		if (document) {
			return this.decorateDocument(document)
		}
		if (uri) {
			return this.decorateUri(uri)
		}
	}

	private decorateEditor (editor: TextEditor) {
		const executedArray: DecorationOptions[] = []
		const executableArray: DecorationOptions[] = []
		this.decorateCount++

		if (!editor) {
			log.warn('No editor to decorate')
			return false
		}

		log.debug('Decorate? ' + editor.document.uri.fsPath + ' (count=' + this.decorateCount + ', results=' + this.recentCoverage.size + ')')

		const rc = this.recentDecorations.get(editor.document.uri.fsPath)
		if (rc) {
			return this.setDecorations(editor, rc)
		}

		const tc = this.recentCoverage.get(editor.document.uri.fsPath) as FileCoverage
		if (!tc) {
			log.trace('No coverage for ' + editor.document.uri.fsPath + ', coverage.size=' + this.recentCoverage.size + ', decorations.size=' + this.recentDecorations.size)
			log.trace('  -       have: ' + editor.document.uri.fsPath)
			// for (const [k, v] of this.recentCoverage) {
			// 	log.trace('  - found coverage: ' + k + ' ' + v.detailedCoverage.length)
			// }
			return false
		}

		if (!tc.detailedCoverage) {
			tc.detailedCoverage = []
		}
		tc.detailedCoverage.filter(element => element.executed).forEach(element => {
			const opts: DecorationOptions = {
				hoverMessage: 'Executed line',
				range: element.location as Range,
				// renderOptions: {
				// 	before: {
				// 		contentText: element.executionCount.toString(),
				// 		color: 'rgba(0,0,0,0.5)',
				// 		// fontSize: '0.8em',
				// 		fontWeight: 'bold'
				// 	// after: {
				// 	// 	contentText: element.executionCount.toString(),
				// 	// 	color: 'rgba(0,0,0,0.5)',
				// 	// 	// fontSize: '0.8em',
				// 	// 	fontWeight: 'bold'
				// 	}
				// }
			}
			executedArray.push(opts)
		})
		tc.detailedCoverage.filter(element => element.executed).forEach(element => {
			executableArray.push({ range: element.location as Range })
		})
		// log.info('setDecorations ' + editor.document.uri.fsPath)
		// log.info('  - executedArray.length=' + executedArray.length)
		// log.info('  - executableArray.length=' + executableArray.length)
		// log.info('  - executedArray=' + JSON.stringify(executedArray,null,2))
		// log.info('  - executableArray=' + JSON.stringify(executableArray,null,2))
		this.setDecorations(editor, {executed: executedArray, executable: executableArray})

		// log.info('add recentDecorations ' + editor.document.uri.fsPath)
		this.recentDecorations.set(editor.document.uri.fsPath, {executed: executedArray, executable: executableArray})
		return true
	}

	private setDecorations (editor: TextEditor, lines: IExecLines) {
		if (lines.executable) {
			editor.setDecorations(this.backgroundExecutable, lines.executable)
		}
		if (lines.executed) {
			editor.setDecorations(this.backgroundExecuted, lines.executed)
		}
		return true
	}

	private decorateDocument (document: TextDocument) {
		const editor = window.visibleTextEditors.find(editor => editor.document.uri.fsPath === document.uri.fsPath)
		if (!editor) {
			log.warn('No editor visible for document ' + workspace.asRelativePath(document.uri.fsPath))
			return false
		}
		return this.decorateEditor(editor)
	}

	private decorateUri (uri: Uri) {
		const editor = window.visibleTextEditors.find(editor => editor.document.uri.fsPath === uri.fsPath)
		if (!editor) {
			log.warn('No editor visible for document ' + workspace.asRelativePath(uri.fsPath))
			return false
		}
		return this.decorateEditor(editor)
	}

	getDecorations (uri: Uri) {
		for (const [d, k] of this.recentDecorations) {
			log.debug('--- getDecorations-14 Dec: d=' + d + ' ' + k.executed?.length + ' ' + k.executable?.length)
		}

		const lines = this.recentDecorations.get(uri.fsPath)
		if (!lines) {
			return  { count: this.decorateCount }
		}
		lines.count = this.decorateCount
		return lines
	}

	// provideFileDecoration (uri: Uri, token: CancellationToken) {
	// 	if (token.isCancellationRequested) {
	// 		log.debug('file decoration cancelled')
	// 	}
	// 	this.getDecorations(uri)
	// }
}

export const decorator = Decorator.instance

export class DecorationProvider implements FileDecorationProvider {

	// onDidChangeFileDecorations (e: Uri | Uri[] | undefined) {
	// 	log.info('onDidChangeFileDecorations ' + e)
	// 	// throw new Error('onDidChangeFileDecorations - method not implemented')
	// 	return undefined
	// }

	provideFileDecoration (uri: Uri, token: CancellationToken): ProviderResult<FileDecoration> {
		if (token.isCancellationRequested) {
			log.debug('file decoration cancelled')
		}
		log.info('provideFileDecoration ' + uri.fsPath)
		return undefined
	}
}

window.onDidChangeActiveTextEditor((editor) => {
	if (!editor) {
		// log.debug('--- onDidChangeActiveTextEditor-0 no editor')
		return
	}

	// log.debug('--- onDidChangeActiveTextEditor-1 start ' + editor.document.uri)

	const didDecorate = decorator.decorate(editor)
	if (didDecorate) {
		log.info('decorate complete')
		decorator.getDecorations(editor.document.uri)
	} else {
		log.warn('decorate failed')
	}
})

// window.onDidChangeWindowState((_windowState) => {
// 	log.info('onDidChangeWindowState')
// })
// window.onDidChangeTextEditorOptions((_event) => {
// 	log.info('onDidChangeTextEditorOptions')
// })
// window.onDidChangeVisibleTextEditors((_editors) => {
// 	log.info('onDidChangeVisibleTextEditors')
// })
// window.onDidChangeTextEditorViewColumn((_event) => {
// 	log.info('onDidChangeTextEditorViewColumn')
// })
// window.onDidChangeTextEditorVisibleRanges((event) => {
// 	if (event.textEditor.document.uri.scheme === 'file') {
// 		log.info('onDidChangeTextEditorVisibleRanges')
// 		log.info('event=' + JSON.stringify(event,null,2))
// 	}
// })
