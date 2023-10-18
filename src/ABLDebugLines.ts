
import { Uri, workspace } from "vscode"

function getWorkspaceUri(): Uri {
	if (workspace.workspaceFolders == undefined) {
		throw new Error("No workspace folders defined")
	}
	return workspace.workspaceFolders[0].uri
}

async function readXrefFile(xrefUri: Uri) {
	return await workspace.fs.readFile(xrefUri).then((content) => {
		const str = Buffer.from(content.buffer).toString();
		return str
	}, (reason) => {
		console.error("(readXrefFile) WARNING: xref file not found '" + xrefUri.fsPath + "': " + reason)
		return "xref not found"
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

export class ABLDebugLines {
	map: DebugLineMap[] //TODO - replace with a real map
	incLengths: IncLength[]

	constructor () {
		this.map = []
		this.incLengths = []
	}

	getSourceLine(sourceUri: Uri, debugLine: number) {
		const debugLines = this.map.find((dlm) => dlm.uri.fsPath === sourceUri.fsPath) //TODO - is there a better way to compare URIs?
		if (!debugLines) {
			console.error("cannot find debugLines (1) for " + sourceUri.fsPath + " " + debugLine)
			return null
		}
		return debugLines.lines.find((line) => line.debugLine === debugLine)
	}

	async readLineCount(uri: Uri) {
		return workspace.fs.readFile(uri).then((content) => {
			return Buffer.from(content.buffer).toString().split("\n").length
		})
	}

	async readIncludeLineCount(uri: Uri) {
		return await workspace.fs.readFile(uri).then((content) => {
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

	async importDebugFile(sourceUri: Uri, xrefUri: Uri) {
		return await this.importDebugLines(sourceUri, xrefUri).then((success) => {
			return success
		},	(err) => {
			throw err
		})
	}

	async importDebugLines(sourceUri: Uri, xrefUri: Uri) {
		const incRE = /(\S+) (\S+) (\d+) ([A-Z-]+) (("[^"]+?")|(\S+))/
		let m = this.map.find((dlm) => dlm.uri.fsPath === sourceUri.fsPath)
		if (!m) {
			m = {
				uri: sourceUri,
				lines: [],
				includes: [],
				lineCount: 0
			}
			this.map.push(m)
		}
		if (!m) { throw new Error("cannot find debugLines for " + sourceUri + " [should not hit this!! (1)]") }

		const prom2 = this.readLineCount(sourceUri).then((lc) => {
			if (m) {
				m.lineCount = lc
				return
			}
			throw new Error("cannot find debugLines for " + sourceUri + " [should not hit this!! (10)]")
		}, (err) => {
			throw new Error("cannot find debugLines for " + sourceUri + " [should not hit this!! (11)]")
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
			for (const element of lines) {
				const xref = incRE.exec(element)

				if (xref && (xref[4] === "INCLUDE" || xref[4] === "COMPILE")) {
					const [, ,parent,lineNumStr,xrefType,includeNameRaw] = xref
					if (xrefType === "INCLUDE") {
						const lineNum = Number(lineNumStr)
						const includeName = includeNameRaw.replace(/^"(.*)"$/, '$1').trim()
						const incUri = Uri.joinPath(getWorkspaceUri(),includeName)
						const pUri = Uri.joinPath(getWorkspaceUri(),parent)
						promArr.push(this.readIncludeLineCount(incUri))
						m?.includes.push({includeUri: incUri, parentUri: pUri, parentLineNum: lineNum})
					}
				}
			}
			return Promise.all(promArr)
		}, (err) => {
			//Do nothing, this is expected if the xref file doesn't exist
			console.error("err: " + err)
			return err
		})

		await prom1.then(() => {}, (err) => console.error("prom1 error: " + err))
		await prom2.then(() => {}, (err) => console.error("prom1 error: " + err))

		return await Promise.all([prom1, prom2]).then(() => {
			if (!m) {
				throw new Error("cannot find debugLines for " + sourceUri + " [should not hit this!! (2)]")
			}
			let dbgLine = 0
			for (let i=1; i<=m.lineCount; i++) {
				dbgLine++
				m.lines.push({
					debugLine: dbgLine,
					sourceLine: i,
					incUri: sourceUri,
					incLine: i
				})
				dbgLine = this.injectInclude(m, m.uri, i, i, dbgLine)
			}
		})
	}

	injectInclude(m: DebugLineMap, parentUri: Uri, sourceLine: number, incLine: number, dbgLine: number) {
		const inc = m.includes.find((inc) => inc.parentUri.fsPath === parentUri.fsPath && inc.parentLineNum === incLine)
		if (inc) {
			const incLen = this.incLengths.find((incLen) => incLen.uri.fsPath === inc.includeUri.fsPath)
			if (!incLen) {
				throw new Error("cannot find include length for " + inc.includeUri + " [should not hit this!! (3)]")
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
