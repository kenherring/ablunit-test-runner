import { TextDecoder } from "util"
import { Uri, workspace } from "vscode"
import { PropathParser } from "../ABLPropath"
import log from '../ChannelLogger'

const headerLength = 68

interface IProcedures {
	procLoc: number,
	procName: string,
	procNum: number,
	lineCount: number,
	lines: number[] | undefined
}

interface ISources {
	sourceName: string,
	sourceNum: number | undefined
	sourceUri: Uri
}

interface IIncludeMap {
	sourceLine: number,
	sourceNum: number,
	sourcePath: string,
	sourceUri: Uri
	debugLine: number,
	debugUri: Uri,
}

export interface ISourceMap {
	sourceUri: Uri,
	path: string,
	items: ISourceMapItem[]
}

export interface ISourceMapItem {
	debugLine: number
	debugUri: Uri
	sourceLine: number
	sourcePath: string
	sourceUri: Uri
	procName: string
}

/**
 * Parse RCode (*.r) and return a source map
 * @param uri Uri of the r-code, not the source file.
 **/
export const getSourceMapFromRCode = async (propath: PropathParser, uri: Uri) => {
	// rcode segments: https://docs.progress.com/bundle/openedge-abl-manage-applications/page/R-code-structure.html

	let rawBytes: Uint8Array
	const debug = false
	const dec = new TextDecoder()
	const procs: IProcedures[] = []
	const sources: ISources[] = []
	const map: IIncludeMap[] = []
	const debugLines: ISourceMapItem[] = []

	const toBase10 = (items: Uint8Array) => {
		if (items.length === 4) {
			return items[3] * 256 * 256 * 256 +
				items[2] * 256 * 256 +
				items[1] * 256 +
				items[0]
		} else if (items.length === 2) {
			return items[1] * 256 + items[0]
		} else if (items.length === 1) {
			return items[0]
		}
		throw new Error("invalid length=" + items.length)
	}


	const parseHeader = (raw: Uint8Array) => {
		const rcodeHeader = raw.subarray(0,headerLength)
		const sizeOfSegmentTable = toBase10(rcodeHeader.subarray(30,32))
		const sizeOfSignatures = toBase10(rcodeHeader.subarray(56,58))

		return {
			segmentTableLoc: headerLength + sizeOfSignatures + 16,
			segmentTableSize: sizeOfSegmentTable,
		}

	}

	const parseSegmentTable = (segmentTable: Uint8Array) => {
		const debug = segmentTable.subarray(12,16)
		const debugsize = segmentTable.subarray(28,32)
		const debugLoc = toBase10(debug) + segmentTable.byteOffset + segmentTable.length
		return {
			debugLoc: debugLoc,
			debugSize: toBase10(debugsize)
		}
	}

	const getShort = (num: number, half: number = 1) => {
		if (half === 1) {
			return num & 0x0000ffff
		} else if (half === 2) {
			return num & 0xffff0000
		}
	}

	const getLines = (bytes: Uint32Array, byte: number, lineCount: number) => {
		const lines: number[] = []
		const byteLines = bytes.subarray(byte/4, byte/4 + lineCount)
		for (const element of byteLines) {
			lines.push(element)
		}
		return lines
	}

	const hasZeroBytes = (bytes: Uint32Array, idx: number, count: number = 2) => {
		for (let i=0; i < count; i++) {
			if (bytes[idx + i] != 0) {
				return false
			}
		}
		return true
	}

	const nextDelim = (bytes: Uint32Array, pos: number, count: number = 2, prefix: string = '') => {
		if (debug) {
			log.info(prefix + " count=" + count)
		}
		let next = bytes.indexOf(0,pos/4)

		if (count === 1) {
			return next
		}
		let foundZeroBytes = hasZeroBytes(bytes, next, count)
		while (!foundZeroBytes) {
			next = bytes.indexOf(0,next + 1)
			foundZeroBytes = hasZeroBytes(bytes, next, count)
		}
		return next
	}

	const parseProcName = (bytes: Uint32Array, pos: number, prefix: string = '') => {
		if (debug) {
			log.info(prefix + " [parseProcName] pos=" + pos)
		}
		const childBytes = bytes.subarray(pos/4,nextDelim(bytes,pos,1))

		const arr8 = rawBytes.subarray(childBytes.byteOffset, rawBytes.indexOf(0,childBytes.byteOffset + 1))
		const name2 = dec.decode(arr8)

		return name2
	}

	const parseVar = (_bytes: Uint32Array, _pos: number, _prefix: string = '') => {
		// log.trace(prefix + " TODO - implement rcode parsing function parseVar")
	}

	const parseParam = (_bytes: Uint32Array, _pos: number, _prefix: string = '') => {
		// log.trace(prefix + " TODO - implement rcode parsing function parseParam")
	}

	const parseProcTT = (_bytes: Uint32Array, _pos: number, _prefix: string = '') => {
		// log.trace(prefix + " TODO - implement rcode parsing function parseProcTT")
	}

	const parseProcs = (bytes: Uint32Array, pos: number, prefix: string = '') => {
		const end = nextDelim(bytes, pos + 20, 4, prefix)
		const childBytes = bytes.subarray(pos/4, end)

		let numlines = bytes[childBytes[1]/4 - 2]
		if (childBytes[5] && childBytes[5] != 0) {
			numlines = bytes[childBytes[5]/4 - 2]
		}

		let lines
		if(childBytes[1] && childBytes[1] != 0) {
			lines = getLines(bytes, childBytes[1], numlines)
		}

		if (childBytes[2] && childBytes[2] != 0) {
			parseVar(bytes, childBytes[2], prefix + '.' + childBytes[2] + '-2')
		}

		if (childBytes[3] && childBytes[3] != 0) {
			parseParam(bytes, childBytes[3], prefix + '.' + childBytes[3] + '-3')
		}

		if (childBytes[4] && childBytes[4] != 0) {
			parseProcTT(bytes, childBytes[4], prefix + '.' + childBytes[4] + '-4')
		}

		let pname = undefined
		if (childBytes[5] && childBytes[5] != 0) {
			pname = parseProcName(bytes, childBytes[5], prefix + '.' + childBytes[5] + '-5')
		}

		procs.push({
			procLoc: pos,
			procName: pname ?? '',
			procNum: bytes[childBytes[5]/4 - 1],
			lineCount: numlines,
			lines: lines
		})

		if (childBytes[0] && childBytes[0] != 0) {
			parseProcs(bytes, childBytes[0], prefix + '.' + childBytes[0] + '-0')
		}

		return procs
	}

	const getSourceName = (num: number) => {
		for (const src of sources) {
			if (src.sourceNum === num) {
				return src.sourceName
			}
		}
		throw new Error("[getSourceName] could not find source name for num=" + num + ", uri=" + uri.fsPath)
	}


	const getSourceUri = (num: number) => {
		for (const src of sources) {
			if (src.sourceNum === num) {
				return src.sourceUri
			}
		}
		throw new Error("[getSourceUri] could not find source name for num=" + num + ", uri=" + uri.fsPath)
	}


	const parseSources = async (bytes: Uint32Array, pos: number, prefix: string = '') => {
		const end = nextDelim(bytes, pos + 4, 1, prefix)
		const childBytes = bytes.subarray(pos/4, end)

		const b = childBytes.slice(0)
		const sourceNum = getShort(b[2])
		b[2] = b[2] & 0xff000000

		const sourceName = dec.decode(b.subarray(2)).replace(/\0/g,'')
		if (sourceNum == undefined) {
			throw new Error("invalid source number: " + sourceNum + " " + sourceName)
		}
		const sourceUri = Uri.joinPath(propath.workspaceFolder.uri, sourceName)

		sources.push({
			sourceName: sourceName.replace(/\\/g,'/'),
			sourceNum: sourceNum,
			sourceUri: sourceUri
		})

		if (childBytes[0] && childBytes[0] != 0) {
			await parseSources(bytes, childBytes[0], prefix + '.' + childBytes[0] + '-0')
		}
		return sources
	}

	const parseTT = (bytes: Uint32Array, pos: number, prefix: string = '') => {
		log.trace(prefix + " TODO - implement rcode parsing function  parseTT (bytes.length=" + bytes.length + ", pos=" + pos + ", byte[" + pos/4 + "]=" + bytes[pos/4] + ")")
	}

	const parseMap = async (bytes: Uint32Array, pos: number, prefix: string = '') => {
		const end = pos/4 + 4
		const childBytes = bytes.subarray(pos/4, end)

		const sourceUri = Uri.joinPath(propath.workspaceFolder.uri, getSourceName(childBytes[3]))

		map.push({
			sourceLine: childBytes[1],
			debugLine: childBytes[2],
			sourceNum: childBytes[3],
			sourcePath: getSourceName(childBytes[3]),
			sourceUri: sourceUri,
			debugUri: getSourceUri(0)
		})

		if (childBytes[0] && childBytes[0] != 0) {
			await parseMap(bytes, childBytes[0], prefix + '.' + childBytes[0] + '-4')
		}

		return map
	}

	const parse4 = (_bytes: Uint32Array, _pos: number, prefix: string = '') => {
		log.trace(prefix + "TODO - implement rcode parsing function parse4")
		throw new Error("parse4 not implemented")
	}

	const getMapLine = (map: IIncludeMap[], linenum: number) => {
		if (map[0].debugLine > linenum) {
			return {
				sourceLine: linenum,
				debugLine: linenum,
				sourceNum: 0,
				sourcePath: getSourceName(0),
				sourceUri: getSourceUri(0),
				debugUri: getSourceUri(0)
			} as IIncludeMap
		}
		let lastMap: IIncludeMap = map[0]
		for (let i=1; i < map.length; i++) {
			if (map[i].debugLine > linenum) {
				return lastMap
			}
			lastMap = map[i]
		}
		return map[map.length - 1]
	}

	const buildDebugLines = () => {
		const debugUri = getSourceUri(0)
		const debugName = getSourceName(0)
		if (map.length === 0) {
			for (const proc of procs) {
				for (const line of proc.lines ?? []) {
					debugLines.push({
						debugLine: line,
						debugUri: debugUri,
						sourceLine: line,
						sourcePath: debugName,
						sourceUri: debugUri,
						procName: proc.procName
					})
				}
			}
			return
		}

		for(const proc of procs) {
			for (const line of proc.lines ?? []) {
				const mapLine = getMapLine(map, line)
				debugLines.push({
					debugLine: line,
					debugUri: mapLine.debugUri,
					sourceLine: mapLine.sourceLine + (line - mapLine.debugLine),
					sourcePath: mapLine.sourcePath,
					sourceUri: mapLine.sourceUri,
					procName: proc.procName
				})
			}
		}

		debugLines.sort((a,b) => a.debugLine - b.debugLine)
		return debugLines
	}

	const parseDebugSegment = async (raw: Uint8Array) => {
		const bytes = new Uint32Array(raw.length / 4)
		for (let i=0; i < raw.length; i=i+4) {
			bytes[i/4] = toBase10(raw.subarray(i,i+4))
		}

		const children = bytes.subarray(0,5)

		if (children[0]) {
			parseProcs(bytes, children[0], children[0].toString())
		}

		if (children[1]) {
			await parseSources(bytes, children[1], children[1].toString())
		}

		if (children[2] && children[2] != 0) {
			parseTT(bytes, children[2], children[2].toString())
		}

		if (children[3] && children[3] != 0) {
			await parseMap(bytes, children[3], children[3].toString())
		}

		if (children[4] && children[4] != 0) {
			parse4(bytes, children[4], children[4].toString())
		}

		buildDebugLines()
		return debugLines
	}


	return workspace.fs.readFile(uri).then(async (raw) => {
		const headerInfo = parseHeader(raw.subarray(0,68))
		const segmentInfo = parseSegmentTable(raw.subarray(headerInfo.segmentTableLoc, headerInfo.segmentTableLoc + headerInfo.segmentTableSize))
		rawBytes = raw.slice(segmentInfo.debugLoc, segmentInfo.debugLoc + segmentInfo.debugSize)
		const debugInfo = await parseDebugSegment(raw.subarray(segmentInfo.debugLoc, segmentInfo.debugLoc + segmentInfo.debugSize))

		const sourceMap: ISourceMap = {
			path: uri.fsPath,
			sourceUri: uri,
			items: debugInfo
		}

		return sourceMap
	})
}
