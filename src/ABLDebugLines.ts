import { PropathParser } from 'ABLPropath'
import { log } from 'ChannelLogger'
import { SourceMap } from 'parse/SourceMapParser'
import { getSourceMapFromRCode } from 'parse/SourceMapRCodeParser'
import { getSourceMapFromXref } from 'parse/SourceMapXrefParser'
import { Uri } from 'vscode'


export class ABLDebugLines {
	private readonly maps = new Map<string, SourceMap>()
	private readonly processingMethodMap = new Map<string, 'rcode' | 'parse' | 'none'>()
	propath: PropathParser

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
