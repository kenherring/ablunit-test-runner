
import { Uri, workspace } from "vscode"

function getWorkspaceUri(): Uri {
	if (workspace.workspaceFolders == undefined) {
		throw "No workspace folders defined"
	}
	return workspace.workspaceFolders[0].uri
}

async function readXrefFile(xrefUri: Uri) {
	return workspace.fs.readFile(xrefUri).then((content) => {
		const str = Buffer.from(content.buffer).toString();
		return str
	}, (reason) => {
		console.error("ERROR readXrefFile:" +  reason)
		return null
	})
}

interface DebugLine {
	debugLine: number
	sourceLine: number
	incUri: Uri
	incLine: number
}

interface XrefInclude {
	includeUri: Uri
	parentUri: Uri
	parentLineNum: number
}

interface IncLength {
	uri: Uri
	lineCount: number
}

interface DebugLineMap {
	uri: Uri
	lineCount: number
	lines: DebugLine[]
	includes: XrefInclude[]
}

class ABLDebugLines {
	map: DebugLineMap[] //TODO - replace with a real map
	incLengths: IncLength[]

	constructor () {
		this.map = []
		this.incLengths = []
	}

	getSourceLine(debugUri: Uri, debugLine: number) {
		var debugLines = this.map.find((dlm) => dlm.uri.fsPath === debugUri.fsPath) //TODO - is there a better way to compare URIs?
		if (!debugLines) {
			console.error("cannot find debugLines for " + debugUri)
			return null
		}
		return debugLines?.lines.find((line) => line.debugLine === debugLine)
	}

	async readLineCount(uri: Uri) {
		return workspace.fs.readFile(uri).then((content) => {
			return Buffer.from(content.buffer).toString().split("\n").length
		})
	}

	async readIncludeLineCount(uri: Uri) {
		return workspace.fs.readFile(uri).then((content) => {
			const lines = Buffer.from(content.buffer).toString().split("\n")
			let lc = lines.length
			if (lines[lines.length] != "") {
				lc++
			}
			this.incLengths.push({
				uri: uri,
				lineCount: lc
			})
		})
	}

	async importDebugLines(debugUri: Uri) {
		const xrefDir = ".builder/.pct0"
		const xrefUri = Uri.joinPath(getWorkspaceUri(),xrefDir,workspace.asRelativePath(debugUri) + ".xref")

		const incRE = /(\S+) (\S+) (\d+) ([A-Z-]+) (("[^"]+?")|(\S+))/
		let m = this.map.find((dlm) => dlm.uri.fsPath === debugUri.fsPath)
		if (!m) {
			m = {
				uri: debugUri,
				lines: [],
				includes: [],
				lineCount: 0
			}
			this.map.push(m)
		}
		if (!m) {
			throw "cannot find debugLines for " + debugUri + " [should not hit this!! (1)]"
		}

		const prom2 = this.readLineCount(debugUri).then((lc) => {
			if (m) {
				m.lineCount = lc
			}
		})

		// This reads the xref to find where the include files belong, and finds how many lines each of those includes has
		// TODO [BUG]: this only works for single line includes.  Need to figure out how to deal with multi-line includes,
		//				 and instances where the include has code which expands to multiple lines or shrinks the preprocessor
		//				suspect this might require using listings, or more likely breaking apart the r-code which I don't want to do
		const prom1 = readXrefFile(xrefUri).then((content) => {
			if (!content) {
				console.error("readXrefFile: content is undefined")
				return
			}
			const lines = content.split("\n")

			const promArr: Promise<void>[] = [Promise.resolve()]
			for (let idx=0; idx < lines.length; idx++) {
				const xref = incRE.exec(lines[idx])
				if (xref && xref[4] == "INCLUDE") {
					const [,source,parent,lineNumStr,xrefType,includeNameRaw] = xref
					const lineNum = Number(lineNumStr)
					const includeName = includeNameRaw.replace(/^"(.*)"$/, '$1').trim()

					const incUri = Uri.joinPath(getWorkspaceUri(),includeName)
					const pUri = Uri.joinPath(getWorkspaceUri(),parent)
					promArr.push(this.readIncludeLineCount(incUri))
					m?.includes.push({includeUri: incUri, parentUri: pUri, parentLineNum: lineNum})
				}
			}
			return Promise.all(promArr)
		})
		

		return Promise.all([prom1, prom2]).then(() => {
			// console.log("NOW... calculate the line mappings")
			if (!m) {
				throw "cannot find debugLines for " + debugUri + " [should not hit this!! (2)]"
			}
			// console.log("m.length=" + m.lineCount)
			// m.includes.forEach((inc) => {
			// 	console.log("inc=" + inc.parentUri + " " + inc.parentLineNum + " " + inc.includeUri)
			// })
			// this.incLengths.forEach((incLen) => {
			// 	console.log("incLen=" + incLen.uri + " " + incLen.lineCount)
			// })

			let dbgLine = 0
			for (let i=1; i<=m.lineCount; i++) {
				dbgLine++
				m.lines.push({
					debugLine: dbgLine,
					sourceLine: i,
					incUri: debugUri,
					incLine: i
				})
				dbgLine = this.injectInclude(m, m.uri, i, i, dbgLine)
			}

			// m.lines.forEach((line) => {
			// 	console.log(line.debugLine + " " + line.sourceLine + " " + line.incLine + " " + line.incUri)
			// })
		})
	}
	injectInclude(m: DebugLineMap, parentUri: Uri, sourceLine: number, incLine: number, dbgLine: number) {
		const inc = m.includes.find((inc) => inc.parentUri.fsPath === parentUri.fsPath && inc.parentLineNum === incLine)
		if (inc) {
			const incLen = this.incLengths.find((incLen) => incLen.uri.fsPath === inc.includeUri.fsPath)
			if (!incLen) {
				throw "cannot find include length for " + inc.includeUri + " [should not hit this!! (3)]"
			}
			for(let incLine=1; incLine<=incLen.lineCount; incLine++) {
				dbgLine++
				m.lines.push({
					debugLine: dbgLine,
					sourceLine: sourceLine,
					incLine: incLine,
					incUri: incLen.uri
				})
				dbgLine = this.injectInclude(m, incLen.uri, sourceLine, incLine, dbgLine)
			}
		}
		return dbgLine
	}
}


const debugLines = new ABLDebugLines()

export async function importDebugFile(debugUri: Uri) {
	return debugLines.importDebugLines(debugUri)
}

export const getSourceLine = (debugUri: Uri, debugLine: number) => {
	return debugLines.getSourceLine(debugUri, debugLine)
}
