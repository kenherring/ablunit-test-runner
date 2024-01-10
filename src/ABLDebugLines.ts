
import { PropathParser } from "./ABLPropath"
import { ISourceMap, getSourceMapFromRCode } from "./parse/RCodeParser"
import { getSourceMapFromSource } from "./parse/SourceParser"

const maps = new Map<string, ISourceMap>()

export class ABLDebugLines {
	propath: PropathParser

	constructor (propath: PropathParser) {
		this.propath = propath
	}

	async getSourceLine (debugSource: string, debugLine: number) {
		if (debugSource.startsWith("OpenEdge.") || debugSource.indexOf("ABLUnitCore") !== -1) {
			return undefined
		}

		if (!debugSource.endsWith(".p") && !debugSource.endsWith(".cls")) {
			debugSource = debugSource.replace(/\./g,'/') + ".cls"
		}

		const debugSourceObj = await this.propath.search(debugSource)
		if (!debugSourceObj) {
			console.error("cannot find debug source in propath (" + debugSource + ")")
			return undefined
		}
		let map = maps.get(debugSource)
		if (!map) {
			try {
				map = await getSourceMapFromRCode(this.propath, await this.propath.getRCodeUri(debugSource))
			} catch (e) {
				console.warn("cannot parse source map from rcode, falling back to source parser (" + debugSource + ")")
				map = await getSourceMapFromSource(this.propath, debugSource)
			}

			if (!map) {
				throw new Error("failed to parse source map (" + debugSource + ")")
			} else {
				maps.set(debugSource, map)
			}
		}
		const ret = map.items.find((line) => line.debugLine === debugLine)
		return ret
	}
}
