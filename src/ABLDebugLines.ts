import { PropathParser } from 'ABLPropath'
import { log } from 'ChannelLogger'
import { SourceMap, SourceMapItem } from 'parse/SourceMapParser'
import { getSourceMapFromRCode } from 'parse/SourceMapRCodeParser'
import { getSourceMapFromXref } from 'parse/SourceMapXrefParser'
import { Position, Range, TextEditor, Uri } from 'vscode'
import * as FileUtils from 'FileUtils'

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

	expire (sourceUri: Uri) {
		log.debug('expire source map for ' + sourceUri.fsPath)
		this.maps.delete(sourceUri.fsPath)
		this.processingMethodMap.delete(sourceUri.fsPath)
	}

	async getDebugListingPosition (source: Uri, include: TextEditor, position: Position) {
		if (!include || include instanceof Uri) {
			throw new Error('Include must be a TextEditor (include=' + include?.fsPath + ')')
		}
		const includeUri = include?.document.uri

		const debugLine = await this.getDebugLine(source, includeUri, position.line + 1)
		if (!debugLine) {
			log.error('Could not determine debug listing line for ' + source.fsPath + ':' + includeUri.fsPath + ':' + position.line)
			throw new Error('Could not determine debug listing line for ' + source.fsPath + ':' + includeUri.fsPath + ':' + position.line)
		}

		let line = position.line
		if (debugLine.debugLine) {
			line = debugLine.debugLine - 1
		}

		const lineBeforeSelection = include.document.lineAt(position.line).text.substring(0, position.character)
		const character = lineBeforeSelection.replace(/\t/g, '        ').length + 12
		return {
			uri: debugLine.debugUri,
			position: new Position(line, character)
		}
	}

	async getSourcePositionWrapper (editor: TextEditor | Uri, _u: undefined, position: Position) {
		return await this.getSourcePosition(editor, position)
	}

	async getSourcePosition (editor: TextEditor | Uri, position: Position) {
		let uri: Uri | undefined = undefined
		if (editor instanceof Uri) {
			uri = editor
		} else {
			uri = editor.document.uri
		}
		if (!uri) {
			log.error('Editor or URI is undefined')
			throw new Error('Editor or URI is undefined')
		}

		const sourceLine = await this.getSourceLine(uri, position.line + 1)
		if (!sourceLine) {
			log.error('Could not determine source line from debugLine ' + uri.fsPath + ':' + position.line)
			throw new Error('Could not determine source line from debugLine ' + uri.fsPath + ':' + position.line)
		}

		let line = position.line
		if (sourceLine.sourceLine) {
			line = sourceLine.sourceLine - 1
		}

		let char = position.character - 12
		if (char < 0) {
			char = 0
		}
		return {
			uri: sourceLine.sourceUri,
			position: new Position(line, char)
		}
	}

	async getDebugLine (source: Uri, include: Uri, line: number) {
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
		if (map.items.length == 0) {
			log.error('Source map has no lines! (uri=' + fileinfo.uri + ')')
			throw new Error('Source map has no lines! (uri=' + fileinfo.uri + ')')
		}

		const sourceItems = map.items.filter((mappedLine) => mappedLine.sourceUri.fsPath === include.fsPath)
		if (sourceItems.length == 0) {
			log.error('Source map has no lines matching ' + include.fsPath)
			throw new Error('Source map has no lines matching ' + include.fsPath)
		}

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

	async getSourceLine (source: string | Uri, line: number) {
		if (typeof source === 'string') {
			source = Uri.file(source)
		}
		const fileinfo = this.propath.search(source)
		if (!fileinfo) {
			log.warn('cannot find module in propath for "' + source + '"')
			return undefined

		}
		const map = await this.getSourceMap(fileinfo.uri)
		if (!map) {
			log.warn('cannot find source map for "' + source + '"')
			return undefined
		}
		const item = map.items.find(i => i.debugLine === line)
		if (item) {
			return item
		}


		const debugItems = map.items.filter((mappedLine) => mappedLine.debugUri.fsPath === source.fsPath)

		const itemAfter = debugItems.filter((mappedLine) => mappedLine.debugLine > line).sort((a, b) => a.debugLine - b.debugLine)[0]
		if (itemAfter) {
			const item = new SourceMapItem({
				debugLine: line,
				debugUri: itemAfter.debugUri,
				sourceLine: itemAfter.sourceLine - (itemAfter.debugLine - line),
				sourceUri: itemAfter.sourceUri,
				procName: itemAfter.procName,
				procNum: itemAfter.procNum,
			})
			return item
		}

		const itemBefore = debugItems.filter((mappedLine) => mappedLine.debugLine < line).sort((a, b) => b.debugLine - a.debugLine)[0]
		if (itemBefore) {
			const item = new SourceMapItem({
				debugLine: line,
				debugUri: itemBefore.debugUri,
				sourceLine: itemBefore.sourceLine + (line - itemBefore.debugLine),
				sourceUri: itemBefore.sourceUri,
				procName: itemBefore.procName,
				procNum: itemBefore.procNum,
			})
			return item
		}
	}

	async getDebugListingRange (source: Uri, include: TextEditor, range: Range) {
		const start = await this.getDebugListingPosition(source, include, range.start)
		const end = await this.getDebugListingPosition(source, include, range.end)
		if (!start || !end) {
			log.error('Could not determine debug range for ' + source.fsPath + ':' + include.document.uri + ':' + range.start.line + '-' + range.end.line)
			return undefined
		}
		return new Range(start.position, end.position)
	}

	async getSourceRange (source: Uri, range: Range) {
		const start = await this.getSourcePosition(source, range.start)
		const end = await this.getSourcePosition(source, range.end)
		if (!start || !end) {
			log.warn('Could not determine source range for ' + source.fsPath + ':' + range.start.line + '-' + range.end.line)
			return undefined
		}
		return new Range(start.position, end.position)
	}

	async getSourceMap (debugSource: Uri) {
		if (debugSource.path.endsWith('.i')) {
			log.error('getSourceMap cannot be called for include files: ' + debugSource.fsPath)
			throw new Error('getSourceMap cannot be called for include files: ' + debugSource.fsPath)
		}
		if (!debugSource.fsPath.endsWith('.p') && !debugSource.fsPath.endsWith('.cls')) {
			debugSource = Uri.file(debugSource.fsPath.replace(/\./g, '/') + '.cls')
		}
		let map = this.maps.get(debugSource.fsPath)
		if (map) {
			log.debug('found map for ' + map.sourceUri.fsPath)
			if (map.modified.valueOf() != FileUtils.getFileModifiedTime(map.sourceUri).valueOf()) {
				log.debug('source map out of date (uri=' + map.sourceUri + ', debugSource=' + debugSource + ')')
			} else {
				log.debug('return previously parsed map for ' + map.sourceUri)
				return map
			}
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
