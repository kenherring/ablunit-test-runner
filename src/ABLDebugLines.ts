import { PropathParser } from 'ABLPropath'
import { log } from 'ChannelLogger'
import { SourceMap } from 'parse/SourceMapParser'
import { getSourceMapFromRCode } from 'parse/SourceMapRCodeParser'
import { getSourceMapFromXref } from 'parse/SourceMapXrefParser'


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
		const map = await this.getSourceMap(debugSource)
		if (!map) {
			return
		}
		const ret = map.items.find((line) => line.debugLine === debugLine)
		return ret
	}

	async getSourceMap (debugSource: string) {
		if (!debugSource.endsWith('.p') && !debugSource.endsWith('.cls')) {
			debugSource = debugSource.replace(/\./g, '/') + '.cls'
		}
		let map = this.maps.get(debugSource)
		if (map) {
			// return previously parsed map
			return map
		}
		if (this.processingMethodMap.get(debugSource) === 'none') {
			return undefined
		}

		const debugSourceObj = await this.propath.search(debugSource)
		if (!debugSourceObj) {
			log.trace('cannot find debug source in propath (' + debugSource + ')')
			return undefined
		}

		// first, attempt to parse source map from rcode
		try {
			map = await getSourceMapFromRCode(this.propath, debugSourceObj.rcodeUri)
			this.processingMethodMap.set(debugSource, 'rcode')
			log.debug('set processing method to rcode for ' + debugSource)
			this.maps.set(debugSource, map)
			return map
		} catch (e) {
			log.warn('failed to parse source map from rcode, falling back to source parser\n\tdebugSource=' + debugSource + '\n\te=' + e)
		}

		// if that fails, attempt to parse source map from xref
		try {
			map = await getSourceMapFromXref(this.propath, debugSource)
			this.processingMethodMap.set(debugSource, 'parse')
			log.debug('set processing method to parse for ' + debugSource)
			this.maps.set(debugSource, map)
			return map
		} catch(e) {
			log.warn('failed to parse source map from xref\n\tdebugSource=' + debugSource + '\n\te=' + e)
		}

		this.processingMethodMap.set(debugSource, 'none')
		log.debug('set processing method to none for ' + debugSource)
		return map
	}
}
