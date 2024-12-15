import { get } from 'node:http'
import { PropathParser } from './ABLPropath'
import { log } from './ChannelLogger'
import { ISourceMap, getSourceMapFromRCode } from './parse/RCodeParser'
import { getSourceMapFromSource } from './parse/SourceParser'


export class ABLDebugLines {
	private readonly maps = new Map<string, ISourceMap>()
	private readonly processingMethodMap = new Map<string, 'rcode' | 'parse'>()
	propath: PropathParser

	constructor (propath: PropathParser) {
		this.propath = propath
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

		const debugSourceObj = await this.propath.search(debugSource)
		if (!debugSourceObj) {
			log.trace('cannot find debug source in propath (' + debugSource + ')')
			return undefined
		}

		let map = this.maps.get(debugSource)
		if (!map) {
			try {
				const rcode = await this.propath.getRCodeUri(debugSource)
				map = await getSourceMapFromRCode(this.propath, rcode)
				this.processingMethodMap.set(debugSource, 'rcode')
			} catch (e) {
				log.warn('cannot parse source map from rcode, falling back to source parser (debugSource=' + debugSource + ', e=' + e + ')')
				map = await getSourceMapFromSource(this.propath, debugSource)
				this.processingMethodMap.set(debugSource, 'parse')
			}

			if (!map) {
				throw new Error('failed to parse source map (' + debugSource + ')')
			} else {
				this.maps.set(debugSource, map)
			}
		}
		return map
	}
}
