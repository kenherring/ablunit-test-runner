
import { PropathParser } from "./ABLPropath"
import { ISourceMap, getSourceMapFromRCode } from "./parse/RCodeParser"

const maps = new Map<string, ISourceMap>()

export class ABLDebugLines {
	propath: PropathParser

	constructor (propath: PropathParser) {
		this.propath = propath
	}

	async getSourceLine (debugSource: string, debugLine: number) {
		// console.log("debugSource=" + debugSource + ", debugLine=" + debugLine)
		if (debugSource.startsWith("OpenEdge.")) {
			return undefined
		}

		if (!debugSource.endsWith(".p") && !debugSource.endsWith(".cls")) {
			debugSource = debugSource.replace(/\./g,'/') + ".cls"
		}

		const debugSourceObj = await this.propath.search(debugSource)
		if (!debugSourceObj) {
			console.error("cannot find debug source " + debugSource)
			return undefined
		}
		let map = maps.get(debugSource)
		if (!map) {
			try {
				map = await getSourceMapFromRCode(this.propath, await this.propath.getRCodeUri(debugSource))
			} catch (e) {
				console.log("getSourceMapForRCode error: " + e)
				return undefined
			}

			if (!map) {
				throw new Error("cannot find debug line map for " + debugSource)
			} else {
				maps.set(debugSource, map)
			}
		}
		const ret = map.items.find((line) => line.debugLine === debugLine)
		return ret
	}
}
