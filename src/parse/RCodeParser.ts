/* eslint-disable no-console */
import { TextDecoder } from "util"
import { Uri, workspace } from "vscode"
import { PropathParser } from "../ABLPropath"

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

	const debug = false

	let BYTE_ORDER: 'BIG_ENDIAN' | 'LITTLE_ENDIAN'
	const dec = new TextDecoder()

	let rawBytes: Uint8Array

	const procs: IProcedures[] = []
	const sources: ISources[] = []
	const map: IIncludeMap[] = []
	const debugLines: ISourceMapItem[] = []


	const parseHeader = (raw: Uint8Array) => {
		const magic = new Uint32Array(raw.buffer, 0, raw.byteLength / 4)[0]

		console.log("magic= " + magic.toString(16) + " " + magic + " " + Uint8toArray(raw.slice(0,4)) + toBase10(raw.slice(0,4)))
		if (magic === 0x56CED309) {
			BYTE_ORDER='BIG_ENDIAN'
		} else if (magic === 0x09D3CE56) {
			BYTE_ORDER='LITTLE_ENDIAN'
		} else {
			throw new Error("invalid magic number - cannot determine byte order")
		}
		console.log("byte order=" + BYTE_ORDER)

		const rcodeHeader = raw.subarray(0,headerLength)
		// const rcodeVersion = raw.subarray(14,16)
		// console.log("rcodeVersion=" + Uint8toArray(rcodeVersion) + " " + rcodeVersion + " " + toBase10(rcodeVersion))
		const sizeOfSegmentTable = toBase10(rcodeHeader.subarray(30,32))
		console.log("sizeOfSegmentTable=" + sizeOfSegmentTable)
		const sizeOfSignatures = toBase10(rcodeHeader.subarray(56,58))
		console.log("sizeOfSignatures=" + sizeOfSignatures)

		return {
			segmentTableLoc: headerLength + sizeOfSignatures + 16,
			segmentTableSize: sizeOfSegmentTable,
		}

	}

	const parseSegmentTable = (segmentTable: Uint8Array) => {
		const debug = segmentTable.subarray(12,16)
		const debugsize = segmentTable.subarray(28,32)
		const debugLoc = toBase10(debug) + segmentTable.byteOffset + segmentTable.length
		console.log("debugLoc= " + Uint8toArray(debug) + " " + toBase10(debug))
		console.log("debugSize= " + Uint8toArray(debugsize) + " " + toBase10(debugsize))
		console.log("debugLoc = " + debugLoc)

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
		// console.log("[getLines] byteLines.length=" + byteLines.length + " " + bytes.length + " " + lineCount)
		// printBytes(byteLines, "[getLines] ", 4, rawBytes)

		for (const element of byteLines) {
			lines.push(element)
		}
		return lines
	}

	const hasZeroBytes = (bytes: Uint32Array, idx: number, count: number = 2) => {
		// console.log("hasZeroBytes idx=" + idx + ", count=" + count)
		for (let i=0; i < count; i++) {
			// console.log("hasZeroBytes idx=" + idx + ", i=" + i + ", byte=" + bytes[idx + i])
			if (bytes[idx + i] != 0) {
				// console.log("false!")
				return false
			}
		}
		// console.log("TRUE!")
		return true
	}

	const nextDelim = (bytes: Uint32Array, pos: number, count: number = 2, prefix: string = '') => {
		if (debug) {
			console.log(prefix + " count=" + count)
		}
		// console.log(prefix + " count=" + count)
		let next = bytes.indexOf(0,pos/4)
		// console.log(prefix + " nextDelim pos=" + pos + ", count=" + count + ", next=" + next + " " + next * 4)

		if (count === 1) {
			return next
		}
		let foundZeroBytes = hasZeroBytes(bytes, next, count)
		// console.log("foudnZeroBytes-0=" + foundZeroBytes + " " + next)
		while (!foundZeroBytes) {
			next = bytes.indexOf(0,next + 1)
			foundZeroBytes = hasZeroBytes(bytes, next, count)
			// console.log("foundZeroBytes-1=" + foundZeroBytes + " " + next)
		}
		// console.log("return next=" + next + " " + next * 4)
		return next
	}

	const parseProcName = (bytes: Uint32Array, pos: number, prefix: string = '') => {
		if (debug) {
			console.log(prefix + " [parseProcName] pos=" + pos)
		}
		const childBytes = bytes.subarray(pos/4,nextDelim(bytes,pos,1))
		// console.log("parseProcName pos=" + pos + " childBytes.length=" + childBytes.length)
		// const name = dec.decode(childBytes).replace(/\0/g,'')
		// console.log(prefix + ' name=' + name)

		const arr8 = rawBytes.subarray(childBytes.byteOffset, rawBytes.indexOf(0,childBytes.byteOffset + 1))
		// console.log("arr8.length = " + arr8.length + " " + arr8.indexOf(0))
		const name2 = dec.decode(arr8)
		// console.log("name=" + name + ", name2=" + name2)

		return name2
	}

	const parseVar = (bytes: Uint32Array, pos: number, prefix: string = '') => {
		console.warn(prefix + " TODO - implement parseVar")
		// const childBytes = bytes.subarray(pos/4,nextDelim(bytes,pos,1))
		// console.log("parseVar pos=" + pos + " childBytes.length=" + childBytes.length)

		// for (let i=0; i < childBytes.length; i++) {
		// 	console.log(prefix + ' [var] ' + "byte[" + i + "] = " + childBytes[i])
		// }
	}

	const parseParam = (bytes: Uint32Array, pos: number, prefix: string = '') => {
		console.warn(prefix + " TODO - implement parseParam")
		// const childBytes = bytes.subarray(pos/4,nextDelim(bytes,pos,1))

		// console.log("parseParam pos=" + pos + " childBytes.length=" + childBytes.length)
		// for (let i=0; i < childBytes.length; i++) {
		// 	console.log(prefix + ' [param] ' + "byte[" + i + "] = " + childBytes[i])
		// }
	}

	const parseProcTT = (bytes: Uint32Array, pos: number, prefix: string = '') => {
		console.warn(prefix + " TODO - implement parseProcTT")

		// const childBytes = bytes.subarray(pos/4,nextDelim(bytes,pos,4))

		// console.log("parseProcTT pos=" + pos + " childBytes.length=" + childBytes.length)
		// for (let i=0; i < childBytes.length; i++) {
		// 	console.log(prefix + ' [parseProcTT] ' + "byte[" + i + "] = " + childBytes[i])
		// }
		// throw new Error("TODO - implement parseProcTT")
	}

	const parseProcs = (bytes: Uint32Array, pos: number, prefix: string = '') => {
		const end = nextDelim(bytes, pos + 20, 4, prefix)
		const childBytes = bytes.subarray(pos/4, end)
		// printBytes(childBytes, prefix + ' ', 4, rawBytes)

		console.log(prefix + " parseProcs pos=" + pos + " childBytes.length=" + childBytes.length + ", pos=" + pos + ", nextDelim=" + end * 4)
		for (let i=0; i < childBytes.length; i++) {
			console.log(prefix + ' ' + "byte[" + i + "] = " + childBytes[i])
		}

		let numlines = 0
		if (childBytes[5] && childBytes[5] != 0) {
			numlines = bytes[childBytes[5]/4 - 2]
		} else {
			numlines = bytes[childBytes[1]/4 - 2]
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

		// console.log("pname=" + pname + ", lines=" + lines)

		procs.push({
			procLoc: pos,
			procName: pname ?? '',
			procNum: bytes[childBytes[5]/4 - 1],
			lineCount: numlines,
			lines: lines
		})

		if (childBytes[0] && childBytes[0] != 0) {
			parseProcs(bytes, childBytes[0], prefix + '.' + childBytes[0] + '-0')
		} else {
			// console.log(prefix + ' ' + "FOUND END BYTE " + childBytes[0])
		}

		return procs
	}

	const getSourceName = (num: number) => {
		// console.log("[getSourceName] num=" + num + ", sources.length=" + sources.length)
		for (const src of sources) {
			// console.log("[getSourceName] src.sourceNum=" + src.sourceNum + ", src.sourceName=" + src.sourceName)
			if (src.sourceNum === num) {
				return src.sourceName
			}
		}
		throw new Error("[getSourceName] could not find source name for num=" + num + ", uri=" + uri.fsPath)
	}


	const getSourceUri = (num: number) => {
		for (const src of sources) {
			// console.log("[getSourceUri] src.sourceNum=" + src.sourceNum + ", src.sourceName=" + src.sourceName)
			if (src.sourceNum === num) {
				return src.sourceUri
			}
		}
		throw new Error("[getSourceUri] could not find source name for num=" + num + ", uri=" + uri.fsPath)
	}


	const parseSources = async (bytes: Uint32Array, pos: number, prefix: string = '') => {
		const end = nextDelim(bytes, pos + 4, 1, prefix)
		const childBytes = bytes.subarray(pos/4, end)

		// console.log(prefix + " parseSources pos=" + pos + " childBytes.length=" + childBytes.length + ", pos=" + pos + ", nextDelim=" + end * 4)
		// for (let i=0; i < childBytes.length; i++) {
		// 	console.log(prefix + ' ' + "byte[" + i + "] = " + childBytes[i])
		// }

		const b = childBytes.slice(0)
		const sourceNum = getShort(b[2])
		b[2] = b[2] & 0xff000000

		const sourceName = dec.decode(b.subarray(2)).replace(/\0/g,'')
		if (sourceNum == undefined) {
			throw new Error("invalid source number: " + sourceNum + " " + sourceName)
		}
		// const sourceSearch = await propath.search(sourceName)
		// if (!sourceSearch) {
		// 	console.error("cannot find source file " + sourceName + " (sourceNum=" + sourceNum + ")")
		// 	throw new Error("cannot find source file " + sourceName + " (sourceNum=" + sourceNum + ")")
		// }
		const sourceUri = Uri.joinPath(propath.workspaceFolder.uri, sourceName)

		// console.log("[parseSources] num=" + sourceNum)
		sources.push({
			sourceName: sourceName.replace(/\\/g,'/'),
			sourceNum: sourceNum,
			sourceUri: sourceUri
		})

		// console.log("incName=" + includes[0].incName + ", incNum=" + includes[0].incNum)
		if (childBytes[0] && childBytes[0] != 0) {
			await parseSources(bytes, childBytes[0], prefix + '.' + childBytes[0] + '-0')
		}
		return sources
	}

	const parseTT = (bytes: Uint32Array, pos: number, prefix: string = '') => {
		console.warn(prefix + " TODO - implement parseTT (bytes.length=" + bytes.length + ", pos=" + pos + ", byte[" + pos/4 + "]=" + bytes[pos/4] + ")")
		// const end = nextDelim(bytes, pos + 4, 4, prefix)
		// const childBytes = bytes.subarray(pos/4, end)

		// console.log(prefix + " parseTT pos=" + pos + " childBytes.length=" + childBytes.length + ", pos=" + pos + ", nextDelim=" + end * 4)
		// for (let i=0; i < childBytes.length; i++) {
		// 	console.log(prefix + ' ' + "byte[" + i + "] = " + childBytes[i] + " " + childBytes[i].toString(16))
		// }
	}

	const parseMap = async (bytes: Uint32Array, pos: number, prefix: string = '') => {
		const end = pos/4 + 4
		const childBytes = bytes.subarray(pos/4, end)

		// console.log("bytes.length=" + bytes.length + " " + pos + " " + (pos/4) + " " + end)
		// console.log(prefix + " parseMap pos=" + pos + " childBytes.length=" + childBytes.length + ", pos=" + pos + ", nextDelim=" + end)
		// for (let i=0; i < childBytes.length; i++) {
		// 	console.log(prefix + ' ' + "byte[" + i + "] = " + childBytes[i])
		// }

		console.log("[parseMap] childBytes[0]=" + childBytes[0] + ", childBytes[3]=" + childBytes[3])
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

	const parse4 = (bytes: Uint32Array, pos: number, prefix: string = '') => {
		console.warn(prefix + "TODO - implement parse4")
		throw new Error("TODO - implement parse4")
		// const end = nextDelim(bytes, pos, 4, prefix)
		// const childBytes = bytes.subarray(pos/4, end)

		// console.log(prefix + " parse4 pos=" + pos + " childBytes.length=" + childBytes.length + ", pos=" + pos + ", nextDelim=" + end * 4)
		// for (let i=0; i < childBytes.length; i++) {
		// 	console.log(prefix + ' ' + "byte[" + i + "] = " + childBytes[i])
		// }
	}

	const getMapLine = (map: IIncludeMap[], linenum: number) => {
		// console.log("map.length=" + map.length + ", linenum=" + linenum)
		if (map[0].debugLine > linenum) {
			return <IIncludeMap>{
				sourceLine: linenum,
				debugLine: linenum,
				sourceNum: 0,
				sourcePath: getSourceName(0),
				sourceUri: getSourceUri(0),
				debugUri: getSourceUri(0)
			}
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
		// console.log(" ----- parseDebugSegment (raw.length=" + raw.length + ") -----")

		const bytes = new Uint32Array(raw.length / 4)
		for (let i=0; i < raw.length; i=i+4) {
			bytes[i/4] = toBase10(raw.subarray(i,i+4))
		}

		// printBytes(bytes)
		// printBytes8(rawBytes)
		// throw new Error("TEST STOP")

		// printBytes(bytes,'',4,rawBytes)

		// if (bytes.length < 1000) {
		// 	printBytes(bytes,'',1)
		// }

		// console.log("\r\n-- MAIN BLOCK --")

		const children = bytes.subarray(0,5)
		// for (let i=0; i < children.length; i++) {
		// 	console.log("children[" + i + "] = " + children[i])
		// }

		if (children[0]) {
			// console.log("\r\n\r\n---------- parse 0 - procs ----------")
			parseProcs(bytes, children[0], children[0].toString())
		}
		// console.log("procedures=" + JSON.stringify(procs,null,2))

		if (children[1]) {
			// console.log("\r\n\r\n---------- parse 1 - include ----------")
			await parseSources(bytes, children[1], children[1].toString())
		}
		// console.log("includes=" + JSON.stringify(sources,null,2))

		if (children[2] && children[2] != 0) {
			// console.log("\r\n\r\n---------- parse 2 - temp-tables ----------")
			parseTT(bytes, children[2], children[2].toString())
		}

		if (children[3] && children[3] != 0) {
			// console.log("\r\n\r\n---------- parse 3 - map ----------")
			await parseMap(bytes, children[3], children[3].toString())
		}
		// console.log("map=" + JSON.stringify(map,null,2))

		if (children[4] && children[4] != 0) {
			// console.log("\r\n\r\n---------- parse 4 - ??? ----------")
			parse4(bytes, children[4], children[4].toString())
		}

		buildDebugLines()
		// console.log("debugLines = " + JSON.stringify(debugLines,null,2))
		// console.log("debugLines[-1]=" + JSON.stringify(debugLines[debugLines.length - 1]))
		// console.log("[parseDebugSegment] debugLines.length=" + debugLines.length)

		return debugLines
	}


	return workspace.fs.readFile(uri).then(async (raw) => {
		let littleEndian = false
		let bigEndian = false

		// 0x56CED309 = big endian byte order
		// 0x09D3CE56 = little endian byte order
		if (raw[0] === 11 && raw[1] === 323 && raw[2] === 326 && raw[3] === 126) {
			if (raw.subarray(0,4).toString() === "11,323,326,126") {
				littleEndian = true
			} else {
				bigEndian = true
			}
			console.log("littleEndian=" + littleEndian + ", bigEndian=" + bigEndian)
		}

		// console.log("parseHeader")
		const headerInfo = parseHeader(raw.subarray(0,68))
		// console.log("parseSegmentTable")
		const segmentInfo = parseSegmentTable(raw.subarray(headerInfo.segmentTableLoc, headerInfo.segmentTableLoc + headerInfo.segmentTableSize))
		// console.log("parseDebugSegment loc=" + segmentInfo.debugLoc + ", size=" + segmentInfo.debugSize)
		rawBytes = raw.slice(segmentInfo.debugLoc, segmentInfo.debugLoc + segmentInfo.debugSize)
		const debugInfo = await parseDebugSegment(raw.subarray(segmentInfo.debugLoc, segmentInfo.debugLoc + segmentInfo.debugSize))
		// console.log("debugInfo = " + JSON.stringify(debugInfo,null,2))

		const sourceMap: ISourceMap = {
			path: uri.fsPath,
			sourceUri: uri,
			items: debugInfo
		}

		// console.log("return sourceMap=" + JSON.stringify(sourceMap,null,2))

		return sourceMap
	})
}

function Uint8toArray (items: Uint8Array) {
	const ret: number[] = []
	for (const item of items) {
		ret.push(item)
	}
	return ret
}

function toBase10 (items: Uint8Array) {
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
	console.log("invalid length=" + items.length)
	throw new Error("invalid length=" + items.length)
}

function printBytes (items: Uint32Array, prefix: string = '', bytesPerLine: number = 4, rawBytes: Uint8Array | undefined = undefined) {
	const enc = new TextDecoder()

	let arr8: Uint8Array
	if (rawBytes) {
		console.log("use rawBytes")
		arr8 = rawBytes.subarray(items.byteOffset, items.byteOffset + items.byteLength)
	} else {
		console.log("items converted to Uint8Array")
		arr8 = new Uint8Array(items.length * 4)
		for (let i=0; i < items.length; i++) {
			arr8[i*4+0] = (items[i] & 0x000000ff)
			arr8[i*4+1] = (items[i] & 0x0000ff00) >> 8
			arr8[i*4+2] = (items[i] & 0x00ff0000) >> 16
			arr8[i*4+3] = (items[i] & 0xff000000) >> 24
		}
	}

	for (let i=0; i < items.length; i=i+bytesPerLine) {
		const startOffset = items.subarray(i).byteOffset.toString().padStart(3,' ')
		let d = ''
		let e = ''
		let n = ''
		let s = ''

		for (let j=0; j < bytesPerLine; j++) {
			if (i + j >= items.length) {
				break
			}
			d = d + items[i + j].toString(16).padStart(8,'0') + ' '
			for (let k=0; k < 4; k++) {
				e = e + arr8[i*4+j*4+k].toString(16).padStart(2,'0') + ' '
			}
			n = n + items[i + j].toString(10).padStart(8,' ') + ' '

			let si = ''
			if (items[i + j] > items.length * (bytesPerLine / 4)) {
				si = enc.decode(items.subarray(i+j,i+j+1))
			} else {
				si = items[i+j].toString(10).replace(/\b/,'').replace(/\0/,'')
			}
			s = s + si.padStart(4,' ') + ' '
			e = e + '  '
		}
		console.log(prefix + startOffset + ": " +
						d.padEnd(bytesPerLine * 9,' ') + " | " +
						e.trim().padEnd(1 + bytesPerLine * 13,' ') + " | " +
						s.trim().padEnd(bytesPerLine * 5,' ') + " | " +
						n)
	}
	// console.log(prefix + items.subarray(items.length - (items.length % 4)).byteOffset.toString().padStart(3,' ') + ": " + d + " | " + s + " | " + n)
}
