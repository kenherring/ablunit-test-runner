import { PropathParser } from './ABLPropath'
import { log } from './ChannelLogger'
import { ISourceMap, getSourceMapFromRCode } from './parse/RCodeParser'
import { getSourceMapFromSource } from './parse/SourceParser'

const maps = new Map<string, ISourceMap>()

export class ABLDebugLines {
	propath: PropathParser

	constructor (propath: PropathParser) {
		this.propath = propath
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
		let map = maps.get(debugSource)
		if (!map) {
			try {
				map = await getSourceMapFromRCode(this.propath, await this.propath.getRCodeUri(debugSource))
			} catch (e) {
				log.warn('cannot parse source map from rcode, falling back to source parser (debugSource=' + debugSource + ', e=' + e + ')')
				map = await getSourceMapFromSource(this.propath, debugSource)
			}

			if (!map) {
				throw new Error('failed to parse source map (' + debugSource + ')')
			} else {
				maps.set(debugSource, map)
			}
		}
		const ret = map.items.find((line) => line.debugLine === debugLine)
		return ret
	}
}
