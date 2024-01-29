import { ABLResults } from "./ABLResults"
import { CancellationToken, DecorationOptions, FileDecoration, FileDecorationProvider, ProviderResult, Range, TestItem, TextDocument, TextEditor, TextEditorDecorationType, Uri, window, workspace } from 'vscode'
import { existsSync } from 'fs'
import { FileCoverage } from './TestCoverage'
import { log } from "./ChannelLogger"

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
	private recentResults: ABLResults[] | undefined = undefined
	private recentCoverage: Map<string, FileCoverage> | undefined = undefined
	private recentDecorations: Map<string, IExecLines> | undefined = undefined
	// private recentCoverage: WeakMap<Uri, FileCoverage> | undefined = undefined
	// private recentDecorations: WeakMap<Uri, IExecLines> | undefined = undefined
	// private recentCovMap: Map<Uri, FileCoverage> = new Map<Uri, FileCoverage>()
	// private recentDecMap: Map<Uri, IExecLines> = new Map<Uri, IExecLines>()

	private constructor () {
		this.instanceCount = Decorator.instCount
		log.info("Decorator constructor instanceCount=" + this.instanceCount + ' ' + Decorator.instCount)
		this.backgroundExecutable = window.createTextEditorDecorationType({
			backgroundColor: 'rgba(255,0,0,0.1)',
			// isWholeLine: true,
			// overviewRulerColor: 'rgba(255,0,0,0.5)', // todo
			// after: // display number of times executed
		})
		this.backgroundExecuted = window.createTextEditorDecorationType({
			backgroundColor: 'rgba(0,255,0,0.1)'
		})
	}

	// public static getInstance () {
	// 	if (!Decorator.instance) {
	// 		Decorator.instCount++
	// 		console.log("getInstance: " + Decorator.instCount + " instances")
	// 		Decorator.instance = new Decorator()

	// 	}
	// 	return Decorator.instance
	// }

	getDecorateCount () {
		log.debug("--- getDecorations-1 instanceCount=" + this.instanceCount + ' ' + Decorator.instCount)
		return this.decorateCount
	}

	setRecentResults (results: ABLResults[] | undefined) {
		log.debug("--- setRecentResults-1 instanceCount=" + this.instanceCount + ' ' + Decorator.instCount)
		log.info('setRecentResults-1')
		this.recentResults = results
		log.info('setRecentResults-2')
		this.recentCoverage = undefined
		this.recentDecorations = undefined
		log.info('setRecentResults-3')
		if (!this.recentResults) {
			log.info('setRecentResults-4')
			this.recentCoverage = undefined
			log.info('setRecentResults-5')
			return
		}
		log.info('setRecentResults-6')
		this.recentCoverage = new Map<string, FileCoverage>()
		// this.recentCovMap = new Map<Uri, FileCoverage>()
		this.recentDecorations = undefined
		// this.recentDecMap = new Map<Uri, IExecLines>()
		log.info('setRecentResults-7')

		let covCount = 0
		for (const r of this.recentResults) {
			for (const [k, v] of r.testCoverage) {
				if (existsSync(k)) {
					log.debug('recent coverage found file ' + k + ', detailedCoverage.length=' + v.detailedCoverage?.length)
					const uri = Uri.file(k)
					log.debug('recentCoverage.set ' + uri.fsPath + ', detailedCoverage.length=' + v.detailedCoverage?.length)
					this.recentCoverage.set(uri.fsPath, v)
					// log.debug('recentCovMap.set ' + uri.fsPath)
					// this.recentCovMap.set(uri, v)
					covCount++
				}
			}
		}
		log.info('setRecentResults-11 covCount=' + covCount)
		// TODO - decorate active editors?
	}

	getRecentResults () {
		log.debug("--- getRecentResults-1 instanceCount=" + this.instanceCount + ' ' + Decorator.instCount)
		log.info('getRecentResults = ' + this.recentResults?.length)
		return this.recentResults
	}

	decorate (editor?: TextEditor, document?: TextDocument, uri?: Uri) {
		if (!this.recentCoverage) {
			log.warn('no recent coverage')
			return
		}
		// if (!this.recentDecorations) {
		// 	log.warn('no recent decorations')
		// 	return
		// }

		if (editor) {
			return this.decorateEditor(editor)
		}
		if (document) {
			this.decorateDocument(document)
			return
		}
		if (uri) {
			this.decorateUri(uri)
			return
		}
	}

	private decorateEditor (editor: TextEditor) {
		log.debug("--- decorate-1 instanceCount=" + this.instanceCount + ' ' + Decorator.instCount)

		const executedArray: DecorationOptions[] = []
		const executableArray: DecorationOptions[] = []
		this.decorateCount++
		log.trace('decorate ' + this.decorateCount)

		console.info('300 editor=' + editor.document.uri.fsPath)
		if (!editor) {
			console.info('321')
			log.warn('No editor to decorate')
			return false
		}

		console.info('330')
		log.debug("Decorate? " + editor.document.uri.fsPath + ' (count=' + this.decorateCount + ', results=' + this.recentResults?.length + ')')

		const tc = this.recentCoverage!.get(editor.document.uri.fsPath)
		if (!tc) {
			log.warn("No coverage for " + editor.document.uri.fsPath
				+ ', recentCoverage.size=' + this.recentCoverage?.size
				+ ', recentDecorations.size=' + this.recentDecorations?.size)
			log.warn('  -     have: ' + editor.document.uri.fsPath)
			for (const [k, v] of this.recentCoverage || []) {
				log.warn('  - found cov: ' + k + ' ' + v.detailedCoverage?.length)
			}
			for (const [k, v] of this.recentDecorations || []) {
				log.warn('  - found dec: ' + k + ' ' + v.executed?.length + ' ' + v.executable?.length)
			}
			return false
		}

		// todo - join consecutive line ranges

		tc.detailedCoverage?.filter(element => element.executionCount > 0).forEach(element => {
			const opts: DecorationOptions = {
				hoverMessage: 'Executed ' + element.executionCount + ' times',
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
			// executedArray.push({ range: element.location as Range })
		})
		tc.detailedCoverage?.filter(element => element.executionCount === 0).forEach(element => {
			executableArray.push({ range: element.location as Range })
		})
		if (executedArray.length > 0) {
			editor.setDecorations(this.backgroundExecuted, executedArray)
		}
		if (executableArray.length > 0) {
			editor.setDecorations(this.backgroundExecutable, executableArray)
		}

		log.info("add recentDecorations ???")
		if (!this.recentDecorations) {
			log.info("create recentDecorations")
			this.recentDecorations = new Map<string, IExecLines>()
			// this.recentDecMap = new Map<Uri, IExecLines>()
		}
		log.info("add recentDecorations " + editor.document.uri.fsPath)
		this.recentDecorations.set(editor.document.uri.fsPath, {executed: executedArray, executable: executableArray})
		// this.recentDecMap.set(editor.document.uri, {executed: executedArray, executable: executableArray})
		return true
	}

	private decorateDocument (_document: TextDocument) {
		throw new Error('decorateDocument method not implemented.')
	}

	private decorateUri (uri: Uri) {
		const editor = window.visibleTextEditors.find(editor => editor.document.uri.fsPath === uri.fsPath)
		if (!editor) {
			log.warn('No editor visible for document ' + workspace.asRelativePath(uri.fsPath))
		}
		this.decorate(editor)
	}

	decorate2 (editor?: TextEditor | TextDocument | TestItem) {
		log.debug("--- decorate-1 instanceCount=" + this.instanceCount + ' ' + Decorator.instCount)

		const executedArray: DecorationOptions[] = []
		const executableArray: DecorationOptions[] = []
		this.decorateCount++
		log.trace('decorate ' + this.decorateCount)

		if (!editor) {
			log.warn('Editor undefined')
			return Promise.resolve()
		}

		if (editor as TextDocument) {
			const document = editor as TextDocument
			log.info('302 = ' + document.uri.fsPath)
			log.info('303 = ' + window.visibleTextEditors.length)
			window.visibleTextEditors.forEach((editor) => {
				log.info('304 = ' + editor.document.uri.fsPath)
			})
			log.info('305')
			editor = window.visibleTextEditors.find(e => e.document.uri === document.uri)
			if (!editor) {
				log.warn('No editor visible for document ' + workspace.asRelativePath(document.uri.fsPath))
				return Promise.resolve()
			}
		}
		console.info('310')
		if (editor as TestItem) {
			console.info('311')
			const item = editor as TestItem
			editor = window.visibleTextEditors.find(editor => editor.document.uri === item.uri)
			if (!editor?.document.uri) {
				log.warn('No editor for TestItem.label=' + item.label)
				return Promise.resolve()
			}
		}
		console.info('320')
		if (!editor) {
			console.info('321')
			log.warn('No editor to decorate')
			return Promise.resolve()
		}

		console.info('330')
		editor = editor as TextEditor

		log.debug("Decorate? " + editor.document.uri.fsPath + ' (count=' + this.decorateCount + ', results=' + this.recentResults?.length + ')')

		const tc = this.recentCoverage?.get(editor.document.uri.fsPath)
		if (!tc) {
			log.warn("No coverage for " + editor.document.uri.fsPath)
			return Promise.resolve()
		}

		// todo - join consecutive line ranges

		tc.detailedCoverage?.filter(element => element.executionCount > 0).forEach(element => {
			executedArray.push({
				hoverMessage: 'Executed ' + element.executionCount + ' times',
				range: element.location as Range,
				renderOptions: {
					after: {
						contentText: element.executionCount.toString(),
						color: 'rgba(0,0,0,0.5)',
						// fontSize: '0.8em',
						fontWeight: 'bold'
					}
				}
			})
			// executedArray.push({ range: element.location as Range })
		})
		tc.detailedCoverage?.filter(element => element.executionCount === 0).forEach(element => {
			executableArray.push({ range: element.location as Range })
		})
		if (executedArray.length > 0) {
			editor.setDecorations(this.backgroundExecuted, executedArray)
		}
		if (executableArray.length > 0) {
			editor.setDecorations(this.backgroundExecutable, executableArray)
		}

		log.info("add recentDecorations")
		if (!this.recentDecorations) {
			log.info("create recentDecorations")
			this.recentDecorations = new Map<string, IExecLines>()
			// this.recentDecMap = new Map<Uri, IExecLines>()
		}
		log.info("add recentDecorations " + editor.document.uri.fsPath)
		this.recentDecorations.set(editor.document.uri.fsPath, {executed: executedArray, executable: executableArray})
		// this.recentDecMap.set(editor.document.uri, {executed: executedArray, executable: executableArray})
		return Promise.resolve()
	}

	getDecorations (uri: Uri) {
		log.debug("--- getDecorations-1 instanceCount=" + this.instanceCount + ' ' + Decorator.instCount)
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		log.debug("--- getDecorations-10 recentDecorations=" + this.instanceCount + ' ' + this.recentDecorations?.size)
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		// log.debug("--- getDecorations-11 recentCoverage=" + this.recentCoverage + ' ' + this.recentCovMap + ' ' + this.recentCovMap.size)
		log.debug("--- getDecorations-12 instanceCount=" + this.instanceCount + ' ' + Decorator.instCount)

		for (const [d, k]  of this.recentCoverage || []) {
			log.debug("--- getDecorations-13 Cov: d=" + d + ' ' + k.detailedCoverage?.length)
		}
		for (const [d, k] of this.recentDecorations || []) {
			log.debug("--- getDecorations-14 Dec: d=" + d + ' ' + k.executed?.length + ' ' + k.executable?.length)
		}

		// for (const [d, k] of this.recentCovMap) {
		// 	log.debug("--- getDecorations-15 CovMap: d=" + d.fsPath + ' ' + k.detailedCoverage?.length)
		// }
		// for (const [d, k] of this.recentDecMap) {
		// 	log.debug("--- getDecorations-16 DevMap: d=" + d.fsPath + ' ' + k.count + ' ' + k.executed?.length + ' ' + k.executable?.length)
		// }

		const lines = this.recentDecorations?.get(uri.fsPath)
		if (!lines) {
			log.debug("--- getDecorations-20 count=" + this.decorateCount)
			return  { count: this.decorateCount }
		}
		log.debug("--- getDecorations-30")
		lines.count = this.decorateCount
		return lines
	}

	// provideUri (uri: Uri) {

	// 	const recent = this.recentDecorations?.get(uri.fsPath)
	// 	for (const [f, d] of this.recentDecorations || []) {
	// 		const dec = new decoration(uri)
	// 		return d
	// 	}

	// }

	// provideFileDecoration (uri: Uri, token: CancellationToken) {
	// 	if (token.isCancellationRequested) {
	// 		log.debug('file decoration cancelled')
	// 	}
	// 	this.provideUri(uri)
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
		log.info("provideFileDecoration " + uri.fsPath)
		return undefined
	}
}

// export class HighlightProvider implements DocumentHighlightProvider {
// 	provideDocumentHighlights (document: TextDocument, position: Range, token: CancellationToken): ProviderResult<DocumentHighlight[]> {
// 		log.info('provideDocumentHighlights ' + document.uri.fsPath)
// 		return undefined
// 	}
// }

window.onDidChangeActiveTextEditor((editor) => {
	if (!editor) {
		log.debug("--- onDidChangeActiveTextEditor-0 no editor")
		return
	}

	log.debug("--- onDidChangeActiveTextEditor-1 start " + editor.document.uri)

	const didDecorate = decorator.decorate(editor)
	if (didDecorate) {
		log.info("decorate complete")
		decorator.getDecorations(editor.document.uri)
	} else {
		log.warn('decorate failed')
	}
})

window.onDidChangeWindowState((windowState) => {
	log.info('onDidChangeWindowState')
})
window.onDidChangeTextEditorOptions((event) => {
	log.info('onDidChangeTextEditorOptions')
})
window.onDidChangeVisibleTextEditors((editors) => {
	log.info('onDidChangeVisibleTextEditors')
})
window.onDidChangeTextEditorViewColumn((event) => {
	log.info('onDidChangeTextEditorViewColumn')
})
window.onDidChangeTextEditorVisibleRanges((event) => {
	log.info('onDidChangeTextEditorVisibleRanges')
})
