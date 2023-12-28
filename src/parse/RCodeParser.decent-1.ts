/* eslint-disable no-console */
import { Uri, workspace } from "vscode"

interface IRCodeItem {
	uint: number
	desc: string
	str?: string
}

interface ISourceMapItem {
	debugLine: number
	sourceLine: number
	sourcePath: string
	procName: string
}

interface ISourceMap {
	uri?: Uri,
	path: string,
	items: ISourceMapItem[]
}

// Parse a RCode file (*.r) and return a source map
export function getSourceMapFromRCode (uri: Uri) {
	// input parameter is the Uri of the r-code, not the source file.

	console.log("100")
	return readRCodeToHexArray(uri).then((raw: Uint8Array) => {
		raw = raw.reverse()
		console.log("raw8.length=" + raw.length)

		const c12 = splitUint8Array(raw, 12)
		console.log("c12.length=" + c12.length)
		console.log("--- c12[0] length=" + c12[0].length + "---")
		printArr(c12[0])
		console.log("--- c12[1] length=" + c12[1].length + "---")
		printArr(c12[1])

		const fmap = getFileMap(c12[0])
		console.log("fmap.length=" + fmap.length)
		console.log("fmap = " + JSON.stringify(fmap,null,2))

		const lmap = getModuleLines(c12[1])

		console.log("--- c12[2] ---")
		printArr(c12[2])

		// const c4 =splitUint8Array(c12[0], 4)
		// let idx = -1
		// for(const c of c4) {
		// 	idx++
		// 	console.log("c1[" + idx + "].length = " + c.length)
		// }

		// for (const c of c2) {
		// 	console.log(" ---- ")
		// 	console.log(c.slice(0,3))
		// 	console.log(c.slice(4,7))
		// 	console.log("debugLine=" + lineNum(c.slice(0,3)) + ", sourceLine=" + lineNum(c.slice(4,7)))
		// 	printArr(c)
		// }

		const sourceMap:ISourceMap = {
			path: '',
			items: []
		}

		console.log("return sourceMap=" + JSON.stringify(sourceMap,null,2))

		return sourceMap
	})
}

function getModuleLines (items: Uint8Array) {
	console.log("getNextMap items.length=" + items.length)

	const m = splitUint8Array(items, 8)
	console.log("---------- c.length = " + m.length + " ----------")
	console.log("m.length=" + m.length)

	printArr(m[0])

	const lineMap: [{
		debugNum: number
		unk1: number
		unk2: number
		unk3: number
		unk4: number
		sourceFilename: string

	}?] = []

	// Main Program
	for (const mainIncs of m) {
		console.log("--- mainIncs.length=" + mainIncs.length + " ---")
		if (mainIncs.length === 4 && mainIncs[0] === 0 && mainIncs[1] === 0 && mainIncs[2] === 0 && mainIncs[3] === 0) {
			break
		}

		printArr(mainIncs)
		if (mainIncs[0] === 0 && mainIncs[1] === 0 && mainIncs[2] === 0 && mainIncs[3] === 0) {
			console.log("null")
			continue
		}

		const ret2 = lineMap.push(...parseInclude(mainIncs))
		console.log("ret2.length = " + ret2 + " lineMap = " + JSON.stringify(lineMap,null,2))
	}

	console.log("return lineMap")

	return lineMap
}

function parseInclude (mainIncs: Uint8Array) {
	console.log("[parseInclude] mainIncs.length=" + mainIncs.length)

	if (mainIncs.length < 12) {
		return []
	}

	const c = splitUint8Array(mainIncs, 4)
	console.log(" ----- c.length = " + c.length + " -----")
	printArr(c[0], "c[0] = ")
	const i = trimBeginning(c[0].reverse(), [0,0,0,0])
	printArr(i, " i = ")

	const ret = [{
		parentDebugNum: 0,
		debugNum: i[0],
		unk1: i[4],
		unk2: i[5],
		unk3: i[8],
		unk4: i[10],
		sourceFilename: readString(i, 11)
	}]

	const childType = i[1]

	console.log("startLoop sourceFilename=" + ret[0].sourceFilename + " c.length=" + c.length)
	for (let i=1; i<c.length; i++) {
		console.log(" --- c[" + i + "].length = " + c[i].length + " --- " + childType + " / " + c[i][1] + " ---")
		c[i] = trimBeginning(c[i].reverse(),[0,0,0,0])
		printArr(c[i])


		if (c[i][9] === 0 && (c[i][10] === 8 || c[i][10] === 29)) {
			console.log("INCLUDE m0")
			ret.push({
				parentDebugNum: 0,
				debugNum: c[i][0],
				unk1: c[i][4],
				unk2: c[i][5],
				unk3: c[i][8],
				unk4: c[i][10],
				sourceFilename: readString(c[i], 11)
			})

		} else if (c[i][5] === 0 && c[i][6] === 8) {
			console.log("INCLUDE m1")

			ret.push({
				parentDebugNum: ret[0].parentDebugNum,
				debugNum: 0,
				unk1: c[i][0],
				unk2: c[i][1],
				unk3: c[i][4],
				unk4: c[i][6],
				sourceFilename: readString(c[i], 7)
			})
		} else if (childType === c[i][1] - 2) {
			console.log("OTHER TYPE?")
			printArr(c[i])
		}
		console.log(" --- c[" + i + "] ret.length= " + ret.length + ", sourceFilename=" + ret[ret.length - 1].sourceFilename)
	}
	console.log("ret")

	return ret
}

function trimBeginning (items: Uint8Array, value: number[]) {
	for (let i=0; i<value.length; i++) {
		if (items[i] !== value[i]) {
			return items
		}
	}
	return items.slice(value.length)
}


function getFileMap (items: Uint8Array) {
	const ret: [{
		sourceNum: number,
		lineEnd: number,
		lineBegin: number,
		debugNum: number
	}?] = []

	for (let i=0; i<items.length; i=i+16) {
		// console.log("items.subarray = " + JSON.stringify(items.subarray(i,i+16)))
		if (items.length < i+16) {
			console.log("break")
			break
		}
		ret.push({
			sourceNum: toBase10(items.subarray(i,i+4)),
			lineEnd: toBase10(items.subarray(i+4,i+8)),
			lineBegin: toBase10(items.subarray(i+8,i+12)),
			// debugNum: toBase10(items.subarray(i+12,i+16))
			debugNum: items[i+15]
		})
	}

	console.log("ret=" + JSON.stringify(ret,null,2))
	return ret
}

function arrToBase10 (items: number[]) {
	return items[0] * 256 * 256 * 256 +
		items[1] * 256 * 256 +
		items[2] * 256 +
		items[3]
}

function toBase10 (items: Uint8Array) {
	return items[0] * 256 * 256 * 256 +
		items[1] * 256 * 256 +
		items[2] * 256 +
		items[3]
}

function readString (items: Uint8Array, startIdx: number) {
	let idx = startIdx
	let str = ''

	while (items[idx] !== 0 && idx < items.length) {
		if (items[idx] < 32 || items[idx] > 126) {
			console.error("ERROR: [readString] - character out of range: " + items[idx] + "(" + getAsciiType(items[idx]) + ")")
			return str
		}
		str = str + getAsciiItem(items[idx]).str
		idx++
	}
	// return [str, idx]
	return str
}

function splitUint8Array (items: Uint8Array, count: number, value: number | string = 0) {
	console.log("split items.length = " + items.length)
	if (typeof value === 'string') {
		if (value === 'NUL') {
			value = 0
		} else {
			console.error("ERROR: [splitUint8Array] - value must be a number when a string is provided")
			return []
		}
	}

	const result: Uint8Array[] = []
	let begin = 0
	let found = 0
	let index = 0

	console.log("begin")

	for (const item of items) {
		index++
		if (item === value) {
			found++
			if (found >= count && index % count === 0) {
				// console.log("FOUND=" + found + ",expected=" + count + ", slice.length=" + items.slice(begin,index - count).length)
				result.push(items.slice(begin,index))
				begin = index
			}
		} else {
			found = 0
		}
	}
	// console.log("LAST slice.length=" + items.slice(begin,index).length)
	result.push(items.slice(begin))

	console.log('split' + count + '.length = ' + result.length)
	return result
}

function startsWith (items: Uint8Array, values: string[]) {
	if (items.length < values.length) {
		return false
	}
	for (let i = 0; i < values.length; i++) {
		if (getAsciiType(items[i]) !== values[i]) {
			return false
		}
	}
	return true
}

function printArr (items: Uint8Array, prefix: string = '') {
	let d = ''
	const cols = 8

	for (let i=0; i<items.length; i++) {
		if (i % 4 === 0 && items[i] === 0 && items[i+1] === 0 && items[i+2] === 0 && items[i+3] === 0) {
			// d = d + 'NUL     NUL     NUL     NUL'
			d = d + 'NULNaNaNNULNaNaNNULNaNaNNUL'
			i = i + 3
		} else {
			d = d + getAsciiType(items[i]) + "(" + items[i] + ")"
		}

		if ((i+1) % cols === 0) {
			console.log(prefix + d)
			d = ''
		} else {
			d = d + "\t"
		}
	}

	console.log(prefix + d)
}

function printArrDelim (arr: Uint8Array | Uint8Array[], prefix: string = '') {

	if(arr instanceof Uint8Array) {
		arr = [arr]
	}

	for (const items of arr) {
		let d = ''
		let nulCount = 0
		for (const e of items) {
			if (e === 0) {
				nulCount++
			} else {
				if (nulCount > 0) {
					d = d + "NULx" + nulCount
					console.log(prefix + d)
					nulCount = 0
					d = ''
				}

				d = d + getAsciiType(e) + "(" + e + ")"
				d = d + ","
			}
		}
		if (d != '') {
			if (nulCount > 0) {
				d = d + "NULx" + nulCount + ""
			}
			console.log(prefix + d)
		}
	}
}

// Read the file into an array a 8-bit unsigned integers.
// Cut the array down to just the last section (debug listing lines).f
// Join the array into logical lines based on content and order of the items.
function readRCodeToHexArray (uri: Uri) {
	return workspace.fs.readFile(uri).then((items) => {
		return items
	})
}


function getAsciiItem (val: number): IRCodeItem {
	// TODO Notes
	// * Do we need to convert the codepage? https://docs.progress.com/bundle/openedge-abl-internationalize-applications/page/The-undefined-code-page.html

	const item: IRCodeItem = {
		uint: val,
		desc: getAsciiType(val),
		str: undefined
	}
	if (val >= 32 && val <= 126) {
		item.str = item.desc
	} else {
		switch (item.desc) {
			case 'NUL': item.str = ' \0'; break
			case 'SOH': item.str = '\r\n**'; break
			case 'CAN': item.str = '\x18'; break

			case 'SP': item.str = ' '; break
			case '&VeryThinSpace': item.str = ' '; break

			case 'PAD': item.str = '\t'; break
			case 'HT': item.str = '\t'; break
			case 'LF': item.str = '\r\n'; break
			case '&lf;': item.str = '\r\n'; break
			case 'FF': item.str = '\r\n------\r\n'; break
			case 'nbsp': item.str = ' '; break
			case '&+;': item.str = '+'; break
			case '&-;': item.str = '-'; break
			case '&<<;': item.str = '<<'; break
		}
	}
	return item
}

function getAsciiType (val: number): string {
	switch (val) {
		case 0: return 'NUL'
		case 1: return 'SOH'
		case 2: return 'STX'
		case 3: return 'ETX'
		case 4: return 'EOT'
		case 5: return 'ENQ'
		case 6: return 'ACK'
		case 7: return 'BEL'
		case 8: return 'BS'
		case 9: return 'HT'
		case 10: return 'LF'
		case 11: return 'VT'
		case 12: return 'FF'
		case 13: return 'CR'
		case 14: return 'SO'
		case 15: return 'SI'
		case 16: return 'DLE'
		// case 17: return 'DC1'
		case 17: return 'XON'
		case 18: return 'DC2'
		// case 19: return 'DC3'
		case 19: return 'XOFF'
		case 20: return 'DC4'
		case 21: return 'NAK'
		case 22: return 'SYN'
		case 23: return 'ETB'
		case 24: return 'CAN'
		case 25: return 'EM'
		case 26: return 'SUB'
		case 27: return 'ESC'
		case 28: return 'FS'
		case 29: return 'GS'
		case 30: return 'RS'
		case 31: return 'US'
		case 32: return 'SP'
		case 33: return '!'
		case 34: return '"'
		case 35: return '#'
		case 36: return '$'
		case 37: return '%'
		case 38: return '&'
		case 39: return "'"
		case 40: return '('
		case 41: return ')'
		case 42: return '*'
		case 43: return '+'
		case 44: return ','
		case 45: return '-'
		case 46: return '.'
		case 47: return '/'
		case 48: return '0'
		case 49: return '1'
		case 50: return '2'
		case 51: return '3'
		case 52: return '4'
		case 53: return '5'
		case 54: return '6'
		case 55: return '7'
		case 56: return '8'
		case 57: return '9'
		case 58: return ':'
		case 59: return ';'
		case 60: return '<'
		case 61: return '='
		case 62: return '>'
		case 63: return '?'
		case 64: return '@'
		case 65: return 'A'
		case 66: return 'B'
		case 67: return 'C'
		case 68: return 'D'
		case 69: return 'E'
		case 70: return 'F'
		case 71: return 'G'
		case 72: return 'H'
		case 73: return 'I'
		case 74: return 'J'
		case 75: return 'K'
		case 76: return 'L'
		case 77: return 'M'
		case 78: return 'N'
		case 79: return 'O'
		case 80: return 'P'
		case 81: return 'Q'
		case 82: return 'R'
		case 83: return 'S'
		case 84: return 'T'
		case 85: return 'U'
		case 86: return 'V'
		case 87: return 'W'
		case 88: return 'X'
		case 89: return 'Y'
		case 90: return 'Z'
		case 91: return '['
		case 92: return '\\'
		case 93: return ']'
		case 94: return '^'
		case 95: return '_'
		case 96: return '`'
		case 97: return 'a'
		case 98: return 'b'
		case 99: return 'c'
		case 100: return 'd'
		case 101: return 'e'
		case 102: return 'f'
		case 103: return 'g'
		case 104: return 'h'
		case 105: return 'i'
		case 106: return 'j'
		case 107: return 'k'
		case 108: return 'l'
		case 109: return 'm'
		case 110: return 'n'
		case 111: return 'o'
		case 112: return 'p'
		case 113: return 'q'
		case 114: return 'r'
		case 115: return 's'
		case 116: return 't'
		case 117: return 'u'
		case 118: return 'v'
		case 119: return 'w'
		case 120: return 'x'
		case 121: return 'y'
		case 122: return 'z'
		case 123: return '{'
		case 124: return '|'
		case 125: return '}'
		case 126: return '~'
		case 127: return 'DEL'
		case 128: return 'PAD'
		case 129: return 'HOP'
		case 130: return 'BPH'
		case 131: return 'NBH'
		case 132: return 'IND'
		case 133: return 'NEL'
		case 134: return 'SSA'
		case 135: return 'ESA'
		case 136: return 'HTS'
		case 137: return 'HTJ'
		case 138: return 'VTS'
		case 139: return 'PLD'
		case 140: return 'PLU'
		case 141: return 'RI'
		case 142: return 'SS2'
		case 143: return 'SS3'
		case 144: return 'DCS'
		case 145: return 'PU1'
		case 146: return 'PU2'
		case 147: return 'STS'
		case 148: return 'CCH'
		case 149: return 'MW'
		case 150: return 'SPA'
		case 151: return 'EPA'
		case 152: return 'SOS'
		case 153: return 'SGCI'
		case 154: return 'SCI'
		case 155: return 'CSI'
		case 156: return 'ST'
		case 157: return 'OSC'
		case 158: return 'PM'
		case 159: return 'APC'
		case 160: return 'nbsp'
		case 161: return 'iexcl'
		case 162: return 'cent'
		case 163: return 'pound'
		case 164: return 'curren'
		case 165: return 'yen'
		case 166: return 'brvbar'
		case 167: return 'sect'
		case 168: return 'uml'
		case 169: return 'copy'
		case 170: return 'ordf'
		case 171: return 'laquo'
		case 172: return 'not'
		case 173: return 'shy'
		case 174: return 'reg'
		case 175: return 'macr'
		case 176: return 'deg'
		case 177: return 'plusmn'
		case 178: return 'sup2'
		case 179: return 'sup3'
		// case 180: return 'acute'
		case 180: return '&minus'
		case 181: return 'micro'
		case 182: return 'para'
		case 183: return 'middot'
		case 184: return 'cedil'
		case 185: return 'sup1'
		case 186: return 'ordm'
		case 187: return 'raquo'
		case 188: return 'frac14'
		case 189: return 'frac12'
		case 190: return 'frac34'
		case 191: return 'iquest'
		case 192: return 'Agrave'
		case 193: return 'Aacute'
		case 194: return 'ACI' // Acirc
		case 195: return 'Atilde'
		case 196: return 'Auml'
		case 197: return 'Aring'
		case 198: return 'AElig'
		case 199: return 'Ccedil'
		case 200: return '&VeryThinSpace'
		case 201: return 'Eacute'
		case 202: return 'Ecirc'
		case 203: return 'Euml'
		case 204: return 'Igrave'
		case 205: return 'Iacute'
		case 206: return 'Icirc'
		case 207: return 'Iuml'
		// case 208: return 'Eth'
		case 208: return '&plus+'
		case 209: return 'Ntilde'
		case 210: return 'Ograve'
		case 211: return 'Oacute'
		case 212: return 'Ocirc'
		case 213: return 'Otilde'
		case 214: return 'Ouml'
		case 215: return 'times'
		// case 216: return 'Oslash'
		case 216: return '&Oslash;'
		case 217: return 'Ugrave'
		case 218: return 'Uacute'
		case 219: return 'Ucirc'
		case 220: return 'Uuml'
		case 221: return 'Yacute'
		case 222: return 'THORN'
		case 223: return 'szlig'
		case 224: return 'agrave'
		case 225: return 'aacute'
		// case 226: return 'acirc'
		case 226: return '&<<;'
		case 227: return 'atilde'
		case 228: return 'auml'
		case 229: return 'aring'
		case 230: return 'aelig'
		case 231: return 'ccedil'
		case 232: return 'egrave'
		case 233: return 'eacute'
		case 234: return 'ecirc'
		case 235: return 'euml'
		case 236: return 'igrave'
		case 237: return 'iacute'
		case 238: return 'icirc'
		case 239: return 'iuml'
		// case 240: return 'eth'
		case 240: return '&lf'
		case 241: return 'ntilde'
		case 242: return 'ograve'
		case 243: return 'oacute'
		case 244: return 'ocirc'
		case 245: return 'otilde'
		case 246: return 'ouml'
		case 247: return 'divide'
		case 248: return 'oslash'
		case 249: return 'ugrave'
		case 250: return 'uacute'
		case 251: return 'ucirc'
		case 252: return 'uuml'
		case 253: return 'yacute'
		case 254: return 'thorn'
		case 255: return 'yuml'
		default:
			console.error('unknown ascii value for code: ' + val)
			return val.toString()
	}
}
