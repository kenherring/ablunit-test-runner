import { Uri } from 'vscode'
import { PropathParser } from './ABLPropath'
import { log } from './ChannelLogger'
import { SourceMap } from './parse/SourceMapParser'
import { getSourceMapFromRCode } from './parse/SourceMapRCodeParser'
import { getSourceMapFromXref } from './parse/SourceMapXrefParser'


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

	getSourceLines (debugSource: string | Uri) {
		if (debugSource instanceof Uri) {
			debugSource = debugSource.fsPath
		}
		log.info('debugSource=' + debugSource)
		const map = this.maps.get(debugSource)
		if (!map) {
			throw new Error('no source map found (' + debugSource + ')')
		}
		return map.items
	}

	getProcessingMethod (debugSource: string) {
		return this.processingMethodMap.get(debugSource)
	}

	async getFuncRange (debugSource: string, name: string) {
		const map = await this.getSourceMap(debugSource)
		if (!map) return
		const lines = map.items.filter((line) => {
			return line.procName == name
		})
		if (!lines) {
			log.warn('cannot find function range (' + debugSource + ', ' + name + ')')
			return
		}
		const maxLineNum = Math.max(...lines.map((line) => line.debugLine))
		const minLineNum = Math.min(...lines.map((line) => {
			if (line.debugLine > 0) {
				return line.debugLine
			}
			return 999999999
		}))
		return { minLineNum, maxLineNum }
	}

	async getSourceZeroLines (debugSource: string) {
		const map = await this.getSourceMap(debugSource)
		if (!map) return
		const lines = map.items.filter((line) => line.debugLine === 0)
		if (!lines) {
			log.warn('cannot find zero line (' + debugSource + ')')
			return
		}
		return lines
	}

	async getSourceLine (debugSource: string, debugLine: number) {
		// if (debugSource.startsWith('OpenEdge.') || debugSource.includes('ABLUnitCore')) {
		// 	return undefined
		// }
		const map = await this.getSourceMap(debugSource)
		if (!map) return
		const ret = map.items.find((line) => line.debugLine === debugLine)
		return ret
	}

	private async getSourceMap (debugSource: string) {
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
			this.maps.set(debugSource, map)
			return map
		} catch (e) {
			log.warn('failed to parse source map from rcode, falling back to source parser\n\tdebugSource=' + debugSource + '\n\te=' + e)
		}

		// if that fails, attempt to parse source map from xref
		try {
			map = await getSourceMapFromXref(this.propath, debugSource)
			this.processingMethodMap.set(debugSource, 'parse')
			this.maps.set(debugSource, map)
			return map
		} catch(e) {
			log.warn('failed to parse source map from xref\n\tdebugSource=' + debugSource + '\n\te=' + e)
		}

		this.processingMethodMap.set(debugSource, 'none')
		return map
	}
}
