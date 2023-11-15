
import { Uri, workspace } from "vscode"
import { PropathParser } from "./ABLPropath"
import { outputChannel } from "./ABLUnitCommon"

export interface IDebugLine {
	srcUri: Uri
	srcLine: number //line number of the source file
	dbgLine: number //debug listing/callstack/profiler line number
	incUri: Uri
	incLine: number //line number of the include
}

interface XrefInclude {
	incUri: Uri
	srcUri: Uri
	srcLine: number
}

interface IncLength {
	incUri: Uri
	lineCount: number
}

interface DebugLineMap {
	debugSourceName: string
	debugSourceUri: Uri
	lineCount: number
	lines: IDebugLine[]
	includes: XrefInclude[]
}

async function readXrefFile(xrefUri: Uri) {
	return await workspace.fs.readFile(xrefUri).then((content) => {
		const str = Buffer.from(content.buffer).toString();
		return str
	}, (reason) => {
		console.error("(readXrefFile) WARNING: xref file not found '" + xrefUri.fsPath + "': " + reason)
		return undefined //don't rethrow, just return undefined because we don't want to stop processing
	})
}

export class ABLDebugLines {
	map: DebugLineMap[]
	incLengths: IncLength[]
	propath: PropathParser

	constructor (propath: PropathParser) {
		this.propath = propath
		this.map = []
		this.incLengths = []
	}

	async getSourceLine(debugSourceName: string, debugLine: number) {
		let  debugLines = this.map.find((dlm) => dlm.debugSourceName == debugSourceName)
		if (!debugLines) {
			const fileinfo = await this.propath.search(debugSourceName)
			if (!fileinfo) {
				if (!debugSourceName.startsWith("OpenEdge.") && debugSourceName != "ABLUnitCore.p") {
					console.error("(getSourceLine) cannot find " + debugSourceName + " in propath.")
				}
				return undefined
			}
			try {
				debugLines = await this.importDebugLines(debugSourceName, fileinfo.uri, fileinfo.xrefUri)
			} catch (e) {
				outputChannel.appendLine("cannot read: " + fileinfo.uri.fsPath)
				console.warn("cannot read " + fileinfo.uri.fsPath)
				return undefined
			}
		}
		return debugLines.lines.find((line) => line.dbgLine === debugLine)
	}

	async readLineCount(uri: Uri) {
		return workspace.fs.readFile(uri).then((content) => {
			return Buffer.from(content.buffer).toString().split("\n").length
		})
	}

	async readIncludeLineCount(uri: Uri) {
		return await workspace.fs.readFile(uri).then((content) => {
			const lines = Buffer.from(content.buffer).toString().replace(/\r/g,'').split("\n")

			let lc = lines.length
			if (lines[lines.length] != "") {
				lc++
			}
			this.incLengths.push({
				incUri: uri,
				lineCount: lc
			})
		})
	}

	async importDebugLines(debugSourceName: string, debugSourceUri: Uri,  xrefUri: Uri) {
		// const incRE = /(\S+) (\S+) (\d+) ([A-Z-]+) (("[^"]+?")|(\S+))/
		const incRE = /(\S+) (\S+) (\d+) ([A-Z-_"]+)\s+(.*)/

		const got = this.map.find((dlm) => dlm.debugSourceName === debugSourceName)
		if (got) {
			return got
		}

		const m: DebugLineMap = {
			debugSourceName: debugSourceName,
			debugSourceUri: debugSourceUri,
			lines: [],
			includes: [],
			lineCount: 0
		}
		this.map.push(m)

		m.lineCount = await this.readLineCount(debugSourceUri)

		// This reads the xref to find where the include files belong, and finds how many lines each of those includes has
		// TODO [BUG]: this only works for single line includes.  Need to figure out how to deal with multi-line includes,
		//				 and instances where the include has code which expands to multiple lines or shrinks the preprocessor
		//				suspect this might require using listings, or more likely breaking apart the r-code which I don't want to do

		const content = await readXrefFile(xrefUri)

		if (content) {
			const lines = content.split("\n")
			for(let idx=0; idx < lines.length; idx++) { // NOSONAR
				const line = lines[idx]
				const xref = incRE.exec(line)

				if (xref && xref.length >= 5 && xref[4] == "INCLUDE") {
					const [, relativePath, ,lineNumStr, ,includeNameRaw] = xref
					const pinfo = await this.propath.search(relativePath)
					const lineNum = Number(lineNumStr)
					const includeName = includeNameRaw.replace(/^"(.*)"$/, '$1').trim()
					const incinfo = await this.propath.search(includeName)
					if (incinfo) {
						m.includes.push({incUri: incinfo.uri, srcUri: pinfo!.uri, srcLine: lineNum})
						await this.readIncludeLineCount(incinfo.uri)
					}
				}
			}
		}

		let dbgLine = 0
		for (let i=1; i<=m.lineCount; i++) {
			dbgLine++
			m.lines.push({
				srcUri: debugSourceUri,
				srcLine: i,
				dbgLine: dbgLine,
				incUri: debugSourceUri,
				incLine: i
			})
			// console.log("add-1: " + i + " " + dbgLine + " " + i + " " + debugSourceUri.fsPath + " " + debugSourceUri.fsPath)
			dbgLine = this.injectInclude(m, m.debugSourceUri, i, i, dbgLine)
		}
		return m
	}

	injectInclude(m: DebugLineMap, parentUri: Uri, sourceLine: number, incLine: number, dbgLine: number) {
		const inc = m.includes.find((inc) => inc.srcUri.fsPath === parentUri.fsPath && inc.srcLine === incLine)
		if (inc) {
			const incLen = this.incLengths.find((incLen) => incLen.incUri.fsPath === inc.incUri.fsPath)
			if (!incLen) {
				throw new Error("cannot find include length for " + inc.incUri + " [should not hit this!! (3)]")
			}
			for(let incLine=1; incLine<=incLen.lineCount; incLine++) {
				if (incLine === incLen.lineCount) {
					break
				}
				dbgLine++
				m.lines.push({
					srcUri: parentUri,
					srcLine: sourceLine,
					dbgLine: dbgLine,
					incUri: incLen.incUri,
					incLine: incLine
				})
				// console.log("add-2: " + sourceLine + " " + dbgLine + " " + incLine + " " + parentUri.fsPath + " " + incLen.incUri.fsPath)
				dbgLine = this.injectInclude(m, incLen.incUri, sourceLine, incLine, dbgLine)
			}
		}
		return dbgLine
	}
}
