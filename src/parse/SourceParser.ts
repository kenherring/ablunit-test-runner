import { Uri, workspace } from 'vscode'
import { PropathParser } from '../ABLPropath'
import { logToChannel } from '../ABLUnitCommon'

interface IXrefInclude {
	incUri: Uri
	srcUri: Uri
	srcLine: number
}

interface IIncLength {
	incUri: Uri
	lineCount: number
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

async function readXrefFile (xrefUri: Uri) {
	return await workspace.fs.readFile(xrefUri).then((content) => {
		const str = Buffer.from(content.buffer).toString()
		return str
	}, (reason) => {
		console.error("xref file not found '" + xrefUri.fsPath + "\n  - reason=" + reason)
		return undefined // don't rethrow, just return undefined because we don't want to stop processing
	})
}

export const getSourceMapFromSource = async (propath: PropathParser, debugSourceName: string) => {
	const map: ISourceMap[] = []
	const incLengths: IIncLength[] = []
	const includes: IXrefInclude[] = []
	const warnings: string[] = []
	let lineCount: number = 0


	const readLineCount = (uri: Uri) => {
		return workspace.fs.readFile(uri).then((content) => {
			return Buffer.from(content.buffer).toString().split("\n").length
		})
	}

	const readIncludeLineCount = async (uri: Uri) => {
		return await workspace.fs.readFile(uri).then((content) => {
			const lines = Buffer.from(content.buffer).toString().replace(/\r/g,'').split("\n")

			let lc = lines.length
			if (lines[lines.length] != "") {
				lc++
			}
			incLengths.push({
				incUri: uri,
				lineCount: lc
			})
		})
	}

	const injectInclude = (m: ISourceMap, parentUri: Uri, sourceLine: number, incLine: number, dbgLine: number) => {
		const inc = includes.find((inc) => inc.srcUri.fsPath === parentUri.fsPath && inc.srcLine === incLine)
		if (inc) {
			const incLen = incLengths.find((incLen) => incLen.incUri.fsPath === inc.incUri.fsPath)
			if (!incLen) {
				throw new Error("cannot find include length for " + inc.incUri + " [should not hit this!! (3)]")
			}
			for(let incLine=1; incLine<=incLen.lineCount; incLine++) {
				if (incLine === incLen.lineCount) {
					break
				}
				dbgLine++
				m.items.push({
					debugUri: parentUri,
					debugLine: dbgLine,
					sourceUri: incLen.incUri,
					sourcePath: incLen.incUri.fsPath,
					sourceLine: incLine,
					procName: ''
				})
				dbgLine = injectInclude(m, incLen.incUri, sourceLine, incLine, dbgLine)
			}
		}
		return dbgLine
	}

	const importDebugLines = async (sourcePath: string, debugSourceUri: Uri,  xrefUri: Uri) => {
		// const incRE = /(\S+) (\S+) (\d+) ([A-Z-]+) (("[^"]+?")|(\S+))/
		const incRE = /(\S+) (\S+) (\d+) ([A-Z-_"]+)\s+(.*)/

		const got = map.find((dlm) => dlm.path === sourcePath)
		if (got) {
			return got
		}

		const m: ISourceMap = {
			path: sourcePath,
			sourceUri: debugSourceUri,
			items: []
		}
		map.push(m)

		lineCount = await readLineCount(debugSourceUri)

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
					const pinfo = await propath.search(relativePath)
					const lineNum = Number(lineNumStr)
					const includeName = includeNameRaw.replace(/^"(.*)"$/, '$1').trim()
					const incinfo = await propath.search(includeName)
					if (pinfo && incinfo) {
						includes.push({incUri: incinfo.uri, srcUri: pinfo.uri, srcLine: lineNum})
						await readIncludeLineCount(incinfo.uri)
					}
				}
			}
		}

		let dbgLine = 0
		for (let i=1; i<=lineCount; i++) {
			dbgLine++

			m.items.push({
				debugLine: dbgLine,
				debugUri: debugSourceUri,
				sourceLine: i,
				sourcePath: sourcePath,
				sourceUri: debugSourceUri,
				procName: ''
			})
			dbgLine = injectInclude(m, m.sourceUri, i, i, dbgLine)
		}
		return m
	}

	const getSourceMap = async () => {
		let  debugLines = map.find((dlm) => dlm.path === debugSourceName)
		if (!debugLines) {
			const fileinfo = await propath.search(debugSourceName)
			if (!fileinfo) {
				if (!debugSourceName.startsWith("OpenEdge.") && debugSourceName != "ABLUnitCore.p") {
					if (warnings.indexOf(debugSourceName) < 0) {
						console.error("[getSourceMap] WARNING: cannot find " + debugSourceName + " in propath.")
						warnings.push(debugSourceName)
					}
				}
				return undefined
			}
			try {
				debugLines = await importDebugLines(debugSourceName, fileinfo.uri, fileinfo.xrefUri)
			} catch (e) {
				logToChannel("cannot read: " + fileinfo.uri.fsPath, "warn")
				return undefined
			}
		}
		return debugLines
	}

	return getSourceMap()
}
