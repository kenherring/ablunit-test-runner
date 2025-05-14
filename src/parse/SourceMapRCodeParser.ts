import { TextDecoder } from 'util'
import { Uri, workspace } from 'vscode'
import { PropathParser } from 'ABLPropath'
import { log } from 'ChannelLogger'
import * as FileUtils from 'FileUtils'
import { IIncludeMap, IDeclarations, ISignature, ISources, ParameterMode, ParameterType, SignatureAccessMode, SignatureType, SourceMap, SourceMapItem } from 'parse/SourceMapParser'

const headerLength = 68

/**
 * Parse RCode (*.r) and return a source map
 * @param uri Uri of the rcode, not the source file.
 **/
export const getSourceMapFromRCode = (propath: PropathParser, uri: Uri) => {
	// rcode segments: https://docs.progress.com/bundle/openedge-abl-manage-applications/page/R-code-structure.html

	if (!uri.path.endsWith('.r')) {
		uri = uri.with({path: uri.path.replace(/\.(p|cls)$/, '.r')})
		if (!uri.path.endsWith('.r')) {
			throw new Error('expected uri.path to end with `.r` but found: ' + uri.path)
		}
	}

	const debug = false
	const decoder = new TextDecoder()
	const declarations: IDeclarations[] = []
	const sources: ISources[] = []
	const includes: IIncludeMap[] = []
	const debugLines: SourceMapItem[] = []

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
		throw new Error('invalid length=' + items.length)
	}

	const parseHeader = (raw: Uint8Array) => {
		const rcodeHeader = raw.subarray(0, headerLength)

		const majorVersion = toBase10(rcodeHeader.subarray(14, 16))
		if (!majorVersion) {
			log.error('failed to parse major version from rcode header. uri=' + uri.fsPath + ', bytes=' + rcodeHeader.toString())
			throw new Error('failed to parse version from rcode header. majorVersion=' + majorVersion + ' uri=' + uri.fsPath)
		}

		const sizeOfSegmentTable = toBase10(rcodeHeader.subarray(30, 32))
		const sizeOfSignatures = toBase10(rcodeHeader.subarray(56, 58))

		return {
			majorVersion: majorVersion,
			signatureTableLoc: headerLength + 16,
			signatureTableSize: sizeOfSignatures,
			segmentTableLoc: headerLength + sizeOfSignatures + 16,
			segmentTableSize: sizeOfSegmentTable,
		}
	}

	const parseSegmentTable = (segmentTable: Uint8Array) => {
		// RCode Segments:
		//  * Action code (1 for main, 1 per internal procedure)
		//  * Expression code (1)
		//  * Text (1 per language)
		//  * Initial value (1)
		//  * Frame (1 per frame)
		//  * Debugger (1)

		const size1 = segmentTable.subarray(16, 20)
		const size2 = segmentTable.subarray(20, 24)
		const size3 = segmentTable.subarray(24, 28)
		const debugsize = segmentTable.subarray(28, 32)
		const loc1 = toBase10(segmentTable.subarray(0, 4)) + segmentTable.byteOffset + segmentTable.length
		const loc2 = toBase10(segmentTable.subarray(4, 8)) + segmentTable.byteOffset + segmentTable.length
		const loc3 = toBase10(segmentTable.subarray(8, 12)) + segmentTable.byteOffset + segmentTable.length
		const debugLoc = toBase10(segmentTable.subarray(12, 16)) + segmentTable.byteOffset + segmentTable.length

		return {
			segmentLoc1: loc1,
			segmentSize1: toBase10(size1),
			segmentLoc2: loc2,
			segmentSize2: toBase10(size2),
			segmentLoc3: loc3,
			segmentSize3: toBase10(size3),
			debugLoc: debugLoc,
			debugSize: toBase10(debugsize),
		}
	}

	const parseSignatureTable = (signatureTable: Uint8Array) => {
		const initialOffset = Number('0x' + decoder.decode(signatureTable.subarray(0, 4)))
		const numElements = Number('0x' + decoder.decode(signatureTable.subarray(4, 8)))

		const signatures: ISignature[] = []
		let start = initialOffset
		let end = signatureTable.indexOf(0, start)
		while (signatures.length < numElements) {
			const sig = decoder.decode(signatureTable.subarray(start, end))
			const parts = sig.split(',')
			const definition = parts[0]

			// log.warn('SignatureType=' + definition.split(' ')[0])
			// log.info('    ' + (definition.split(' ')[0] as SignatureType))

			signatures.push({
				_raw: sig,
				type: definition.split(' ')[0] as SignatureType,
				name: definition.split(' ')[1],
				accessMode: Number(definition.split(' ')[2]) as SignatureAccessMode,
				returns: Number(parts[1].split(' ')[0]) as ParameterType,
				returnTBD: parts[1].split(' ')[1],
				parameters: [],
			})

			for (let i=2; i < parts.length; i++) {
				if (parts[i] == '') {
					continue
				}
				const param = parts[i].split(' ')
				if (param) {
					signatures[signatures.length - 1].parameters.push({
						_raw: parts[i],
						mode: Number(param[0]) as ParameterMode,
						name: param[1],
						type: Number(param[2]) as ParameterType,
						unknown4: param[3],
					})
				}
			}

			start = end + 1
			end = signatureTable.indexOf(0, start)
		}

		return signatures
	}

	const getShort = (num: number, half = 1) => {
		if (half === 1) {
			return num & 0x0000ffff
		} else if (half === 2) {
			return num & 0xffff0000
		}
	}

	const getLines = (debugBytes32: Uint32Array, byte: number, lineCount: number) => {
		const lines: number[] = []
		const byteLines = debugBytes32.subarray(byte/4, byte/4 + lineCount)
		for (const element of byteLines) {
			lines.push(element)
		}
		return lines
	}

	const hasZeroBytes = (bytes: Uint32Array, idx: number, count = 2) => {
		for (let i=0; i < count; i++) {
			if (bytes[idx + i] != 0) {
				return false
			}
		}
		return true
	}

	const nextDelim = (bytes: Uint32Array, pos: number, count = 2, prefix = '') => {
		if (debug) {
			log.info(prefix + ' count=' + count)
		}
		let next = bytes.indexOf(0, pos/4)

		if (count === 1) {
			return next
		}
		let foundZeroBytes = hasZeroBytes(bytes, next, count)
		while (!foundZeroBytes) {
			next = bytes.indexOf(0, next + 1)
			foundZeroBytes = hasZeroBytes(bytes, next, count)
		}
		return next
	}

	const parseProcName = (debugBytes: Uint8Array, debugBytes32: Uint32Array, pos: number, prefix = '') => {
		if (debug) {
			log.info(prefix + ' [parseProcName] pos=' + pos)
		}

		const childBytes = debugBytes32.subarray(pos/4, nextDelim(debugBytes32, pos, 1))

		const arr8 = debugBytes.subarray(childBytes.byteOffset, debugBytes.indexOf(0, childBytes.byteOffset + 1))
		const name = decoder.decode(arr8)

		if (debug) {
			log.info('found procName=' + name)
		}

		return name
	}

	const parseVar = (_debugBytes: Uint8Array, _debugBytes32: Uint32Array, pos: number, prefix = '') => {
		log.trace(prefix + ' TODO - implement rcode parsing function parseVar')
		log.info(prefix + ' pos=' + pos)
		// const end = nextDelim(bytes, pos + 20, 4, prefix)
		// log.info('end=' + end)
		// const childBytes = bytes.subarray(pos/4, end)
		// log.info(prefix + ' 102 childBytes=' + childBytes)

		// const arr8 = rawBytes.subarray(childBytes.byteOffset, rawBytes.indexOf(0, childBytes.byteOffset + 1))
		// log.info('arr8=' + arr8)
		// const value = dec.decode(arr8)
		// log.info('value=' + value)
		// return value
	}

	const parseParam = (_debugBytes: Uint8Array, _debugBytes32: Uint32Array, pos: number, prefix = '') => {
		log.trace(prefix + ' TODO - implement rcode parsing function parseParam')
		log.info(prefix + ' pos=' + pos)
	}

	const parseProcTT = (_debugBytes: Uint8Array, _debugBytes32: Uint32Array, pos: number, prefix = '') => {
		log.trace(prefix + ' TODO - implement rcode parsing function parseProcTT')
		log.info(prefix + ' pos=' + pos)
	}

	const parseProcs = (debugBytes: Uint8Array, debugBytes32: Uint32Array, pos: number, prefix = '') => {
		const end = nextDelim(debugBytes32, pos + 20, 4, prefix)
		const childBytes = debugBytes32.subarray(pos/4, end)
		if (childBytes.length > 6) {
			log.debug('childBytes.length has more info! ' + childBytes.length + ' > 6 (childBytes=' + childBytes + ')')
		}

		let numlines = 0

		for (let i=childBytes.length-1; i >= 1; i--) {
			if (childBytes[i] && childBytes[i] >= 0) {
				numlines = debugBytes32[childBytes[i]/4 - 2]
				break
			}
		}

		let lines: number[] | undefined = undefined
		if(childBytes[1] && childBytes[1] != 0 && numlines > 0) {
			lines = getLines(debugBytes32, childBytes[1], numlines)
		}

		if (debug && childBytes[2] && childBytes[2] != 0) {
			parseVar(debugBytes, debugBytes32, childBytes[2], prefix + '.' + childBytes[2] + '-2')
		}

		if (debug && childBytes[3] && childBytes[3] != 0) {
			parseParam(debugBytes, debugBytes32, childBytes[3], prefix + '.' + childBytes[3] + '-3')
		}

		if (debug && childBytes[4] && childBytes[4] != 0) {
			parseProcTT(debugBytes, debugBytes32, childBytes[4], prefix + '.' + childBytes[4] + '-4')
		}

		let pname: string | undefined = undefined
		if (childBytes[5] && childBytes[5] != 0) {
			pname = parseProcName(debugBytes, debugBytes32, childBytes[5], prefix + '.' + childBytes[5] + '-5')
		}

		declarations.push({
			procLoc: pos,
			procName: pname ?? '',
			procNum: debugBytes32[childBytes[5]/4 - 1],
			lineCount: numlines,
			lines: lines
		})

		if (childBytes[0] && childBytes[0] != 0) {
			parseProcs(debugBytes, debugBytes32, childBytes[0], prefix + '.' + childBytes[0] + '-0')
		}

		return declarations
	}

	const getSourceName = (num: number) => {
		for (const src of sources) {
			if (src.sourceNum === num) {
				return src.sourceName
			}
		}
		throw new Error('could not find source name for num=' + num + ', uri="' + uri.fsPath + '"')
	}

	const getSourceUri = (num: number) => {
		for (const src of sources) {
			if (src.sourceNum === num) {
				return src.sourceUri
			}
		}
		throw new Error('could not find source uri for num=' + num + ', uri="' + uri.fsPath + '"')
	}

	const parseSources = async (bytes: Uint32Array, pos: number, prefix = '') => {
		const end = nextDelim(bytes, pos + 4, 1, prefix)
		const childBytes = bytes.subarray(pos/4, end)

		const b = childBytes.slice(0)
		const sourceNum = getShort(b[2])
		b[2] = b[2] & 0xff000000

		const sourceName = decoder.decode(b.subarray(2)).replace(/\0/g, '')
		if (sourceNum == undefined) {
			throw new Error('invalid source number: ' + sourceNum + ' ' + sourceName)
		}
		const sourceUri = FileUtils.isRelativePath(sourceName) ? Uri.joinPath(propath.workspaceFolder.uri, sourceName) : Uri.file(sourceName)

		sources.push({
			sourceName: sourceName.replace(/\\/g, '/'),
			sourceNum: sourceNum,
			sourceUri: sourceUri
		})

		if (childBytes[0] && childBytes[0] != 0) {
			await parseSources(bytes, childBytes[0], prefix + '.' + childBytes[0] + '-0')
		}
		return sources
	}

	const parseTT = (bytes: Uint32Array, pos: number, prefix = '') => {
		log.trace(prefix + ' TODO - implement rcode parsing function  parseTT (bytes.length=' + bytes.length + ', pos=' + pos + ', byte[' + pos/4 + ']=' + bytes[pos/4] + ')')
	}

	const parseMap = async (bytes: Uint32Array, pos: number, prefix = '') => {
		const end = pos/4 + 4
		const childBytes = bytes.subarray(pos/4, end)

		let sourceUri
		try {
			sourceUri = getSourceUri(childBytes[3])
		} catch(e: unknown) {
			log.debug('getSourceUri(' + childBytes[3] + ') failed. attempting getSourceName(' + childBytes[3] + ') instead. (e=' + e + ')')
			const srcName = getSourceName(childBytes[3])
			if (FileUtils.isRelativePath(srcName)) {
				sourceUri = Uri.joinPath(propath.workspaceFolder.uri, srcName)
			} else {
				sourceUri = Uri.file(srcName)
			}
		}

		includes.push({
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

		return includes
	}

	const parse4 = (_bytes: Uint32Array, _pos: number, prefix = '') => {
		log.trace(prefix + 'TODO - implement rcode parsing function parse4')
		throw new Error('parse4 not implemented')
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
		if (includes.length === 0) {
			for (const proc of declarations) {
				for (const line of proc.lines ?? []) {
					debugLines.push(new SourceMapItem({
						debugLine: line,
						debugUri: debugUri,
						sourceLine: line,
						sourceUri: debugUri,
						procName: proc.procName,
						procNum: proc.procNum,
					}))
				}
			}
			return
		}

		for(const proc of declarations) {
			for (const line of proc.lines ?? []) {
				const mapLine = getMapLine(includes, line)
				debugLines.push(new SourceMapItem({
					debugLine: line,
					debugUri: mapLine.debugUri,
					sourceLine: mapLine.sourceLine + (line - mapLine.debugLine),
					sourceUri: mapLine.sourceUri,
					procName: proc.procName,
					procNum: proc.procNum,
				}))
			}
		}

		debugLines.sort((a, b) => a.debugLine - b.debugLine)
		return debugLines
	}

	const parseSegment1 = (segment1Bytes: Uint8Array) => {
		log.debug('parseSegment1 segment1Bytes.length=' + segment1Bytes.length)
		const crcLocation = 174
		const crc = toBase10(segment1Bytes.subarray(crcLocation, crcLocation + 2))
		return {
			crc: crc,
		}
	}

	const parseDebugSegment = async (debugBytes: Uint8Array) => {
		const debugBytes32 = new Uint32Array(debugBytes.length / 4)
		for (let i=0; i < debugBytes.length; i=i+4) {
			debugBytes32[i/4] = toBase10(debugBytes.subarray(i, i+4))
			// log.info('debugBytes[' + i + '/' + i/4 + '] = ' + debugBytes32[i/4] + '\t' + decoder.decode(debugBytes.subarray(i, i+4)))
		}

		const children = debugBytes32.subarray(0, 5)

		if (children[0]) {
			parseProcs(debugBytes, debugBytes32, children[0], children[0].toString())
		}

		if (children[1]) {
			await parseSources(debugBytes32, children[1], children[1].toString())
		}

		if (children[2] && children[2] != 0) {
			parseTT(debugBytes32, children[2], children[2].toString())
		}

		if (children[3] && children[3] != 0) {
			await parseMap(debugBytes32, children[3], children[3].toString())
		}

		if (children[4] && children[4] != 0) {
			parse4(debugBytes32, children[4], children[4].toString())
		}

		buildDebugLines()
		return debugLines
	}

	return workspace.fs.readFile(uri).then(async (raw) => {
		const headerInfo = parseHeader(raw.subarray(0, 68))
		const rawSegmentTable = raw.subarray(headerInfo.segmentTableLoc, headerInfo.segmentTableLoc + headerInfo.segmentTableSize)
		const segmentInfo = parseSegmentTable(rawSegmentTable)

		const rawSignatureTable = raw.subarray(headerInfo.signatureTableLoc, headerInfo.signatureTableLoc + headerInfo.signatureTableSize)
		const signatures = parseSignatureTable(rawSignatureTable)

		const segment1Bytes = raw.subarray(segmentInfo.segmentLoc1, segmentInfo.segmentLoc1 + segmentInfo.segmentSize1)
		const segment1Info = parseSegment1(segment1Bytes)

		let debugInfo: SourceMapItem[] = []
		if (segmentInfo.debugSize > 0) {
			const debugBytes = raw.slice(segmentInfo.debugLoc, segmentInfo.debugLoc + segmentInfo.debugSize)
			debugInfo = await parseDebugSegment(debugBytes)
		}

		const sourceMap: SourceMap = {
			path: uri.fsPath,
			sourceUri: uri,
			items: debugInfo,
			sources: sources,
			includes: includes,
			declarations: declarations,
			signatures: signatures,
			crc: segment1Info.crc,
		}

		return sourceMap
	})
}
