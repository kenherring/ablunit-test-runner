import { PropathParser } from 'ABLPropath'
import { log } from 'ChannelLogger'
import { SourceMap, SourceMapItem } from 'parse/SourceMapParser'
import { getSourceMapFromRCode } from 'parse/SourceMapRCodeParser'
import { getSourceMapFromXref } from 'parse/SourceMapXrefParser'
import { Position, TextEditor, Uri } from 'vscode'

export class ABLDebugLines {
	private readonly maps = new Map<string, SourceMap>()
	private readonly processingMethodMap = new Map<string, 'rcode' | 'parse' | 'none'>()
	public propath: PropathParser

	constructor (propath?: PropathParser) {
		if (propath) {
			this.propath = propath
		} else {
			this.propath = new PropathParser()
		}
	}

	getSize () {
		return this.maps.size
	}

	getProcessingMethod (debugSource: string) {
		return this.processingMethodMap.get(debugSource)
	}

	async getDebugListingPosition (editor: TextEditor, position: Position) {
		const debugLine = await this.getDebugLine(editor.document.uri, position.line + 1)
		if (!debugLine) {
			throw new Error('Could not determine debug listing line for ' + editor.document.uri.fsPath + ':' + position.line)
		}
		log.info('getDebugListingPosition: debugLine=' + debugLine.debugLine + ', sourceLine=' + position.line + '/' + debugLine.sourceLine)

		let line = position.line
		if (debugLine.debugLine) {
			line = debugLine.debugLine - 1
		}

		const lineBeforeSelection = editor.document.lineAt(position.line).text.substring(0, position.character)
		const character = lineBeforeSelection.replace(/\t/g, '        ').length + 12
		return new Position(line, character)
	}

	async getDebugLine (source: Uri, line: number) {
		const fileinfo = this.propath.search(source)
		if (!fileinfo) {
			log.warn('cannot find module in propath for "' + source.fsPath + '"')
			return undefined
		}
		const map = await this.getSourceMap(fileinfo.uri)
		if (!map) {
			log.warn('cannot find source map for "' + source.fsPath + '"')
			return undefined
		}
		const sourceItems = map.items.filter((mappedLine) => mappedLine.sourceUri.fsPath === source.fsPath)

		const ret = sourceItems.find((mappedLine) => mappedLine.sourceLine === line)
		if (ret) {
			return ret
		}

		const itemAfter = sourceItems.filter((mappedLine) => mappedLine.sourceLine > line).sort((a, b) => a.debugLine - b.debugLine)[0]
		if (itemAfter) {
			const item = new SourceMapItem({
				debugLine: itemAfter.debugLine - (itemAfter.sourceLine - line),
				debugUri: itemAfter.debugUri,
				sourceLine: line,
				sourceUri: itemAfter.sourceUri,
				procName: itemAfter.procName,
				procNum: itemAfter.procNum,
			})
			return item
		}

		const itemBefore = sourceItems.filter((mappedLine) => mappedLine.sourceLine < line).sort((a, b) => b.debugLine - a.debugLine)[0]
		if (itemBefore) {
			const item = new SourceMapItem({
				debugLine: itemBefore.debugLine + (line - itemBefore.sourceLine),
				debugUri: itemBefore.debugUri,
				sourceLine: line,
				sourceUri: itemBefore.sourceUri,
				procName: itemBefore.procName,
				procNum: itemBefore.procNum,
			})
			return item
		}

		return undefined
	}

	async getSourceLine (debugSource: string, debugLine: number) {
		// if (debugSource.startsWith('OpenEdge.') || debugSource.includes('ABLUnitCore')) {
		// 	return undefined
		// }
		const fileinfo = this.propath.search(debugSource)
		if (!fileinfo) {
			log.warn('cannot find module in propath for "' + debugSource + '"')
			return undefined

		}
		const map = await this.getSourceMap(fileinfo.uri)
		if (!map) {
			log.warn('cannot find source map for "' + debugSource + '"')
			return undefined
		}
		const ret = map.items.find((line) => line.debugLine === debugLine)
		return ret
	}

	async getSourceMap (debugSource: Uri) {
		if (!debugSource.fsPath.endsWith('.p') && !debugSource.fsPath.endsWith('.cls')) {
			debugSource = Uri.file(debugSource.fsPath.replace(/\./g, '/') + '.cls')
		}
		let map = this.maps.get(debugSource.fsPath)
		if (map) {
			// return previously parsed map
			return map
		}
		if (this.processingMethodMap.get(debugSource.fsPath) === 'none') {
			log.warn('processing method is none for ' + debugSource)
			return undefined
		}

		const debugSourceObj = this.propath.search(debugSource)
		if (!debugSourceObj) {
			log.trace('cannot find debug source in propath (' + debugSource + ')')
			log.warn('cannot find debug source in propath (' + debugSource + ')')
			return undefined
		}

		// first, attempt to parse source map from rcode
		try {
			map = await getSourceMapFromRCode(this.propath, debugSourceObj.rcodeUri)
			this.processingMethodMap.set(debugSource.fsPath, 'rcode')
			log.debug('set processing method to rcode for ' + debugSource)
			this.maps.set(debugSource.fsPath, map)
			return map
		} catch (e) {
			log.warn('failed to parse source map from rcode, falling back to source parser\n\tdebugSource=' + debugSource + '\n\te=' + e)
		}

		// if that fails, attempt to parse source map from xref
		try {
			map = getSourceMapFromXref(this.propath, debugSource.fsPath)
			this.processingMethodMap.set(debugSource.fsPath, 'parse')
			log.debug('set processing method to parse for ' + debugSource)
			this.maps.set(debugSource.fsPath, map)
			return map
		} catch(e) {
			log.warn('failed to parse source map from xref\n\tdebugSource=' + debugSource + '\n\te=' + e)
		}

		this.processingMethodMap.set(debugSource.fsPath, 'none')
		log.debug('set processing method to none for ' + debugSource)
		return map
	}
}
