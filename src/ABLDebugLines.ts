import { Uri } from 'vscode'
import { PropathParser } from './ABLPropath'
import { log } from './ChannelLogger'
import { SourceMap } from './parse/SourceMapParser'
import { getSourceMapFromRCode } from './parse/SourceMapRCodeParser'
import { getSourceMapFromXref } from './parse/SourceMapXrefParser'


export class ABLDebugLines {
	private readonly maps = new Map<string, SourceMap>()
	private readonly processingMethodMap = new Map<string, 'rcode' | 'parse'>()
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

	async getSourceLine (debugSource: string, debugLine: number) {
		// if (debugSource.startsWith('OpenEdge.') || debugSource.includes('ABLUnitCore')) {
		// 	return undefined
		// }

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
				map = await getSourceMapFromRCode(this.propath, await this.propath.getRCodeUri(debugSource))
				this.processingMethodMap.set(debugSource, 'rcode')
			} catch (e) {
				log.warn('cannot parse source map from rcode, falling back to source parser (debugSource=' + debugSource + ', e=' + e + ')')
				map = await getSourceMapFromXref(this.propath, debugSource)
				this.processingMethodMap.set(debugSource, 'parse')
			}

			if (!map) {
				throw new Error('failed to parse source map (' + debugSource + ')')
			} else {
				this.maps.set(debugSource, map)
			}
		}
		const ret = map.items.find((line) => line.debugLine === debugLine)
		return ret
	}
}
