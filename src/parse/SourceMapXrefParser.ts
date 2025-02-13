import { Uri, workspace } from 'vscode'
import { PropathParser } from '../ABLPropath'
import { log } from 'ChannelLogger'
import * as FileUtils from 'FileUtils'
import { SourceMap, SourceMapItem } from 'parse/SourceMapParser'

interface IXrefInclude {
	incUri: Uri
	srcUri: Uri
	srcLine: number
}

interface IIncLength {
	incUri: Uri
	lineCount: number
}

export const getSourceMapFromXref = (propath: PropathParser, debugSource: string) => {
	const map: SourceMap[] = []
	const incLengths: IIncLength[] = []
	const includes: IXrefInclude[] = []
	let lineCount = 0

	const readIncludeLineCount = (uri: Uri) => {
		log.info('readIncludeLineCounf uri=' + uri.fsPath)
		const lines = FileUtils.readLinesFromFileSync(uri)

		if (lines[lines.length-1] != '') {
			lines.push('')
		}
		const lc = lines.length
		log.info('lc=' + lc)

		incLengths.push({
			incUri: uri,
			lineCount: lc
		})
		log.info('incLengths.push ' + JSON.stringify(incLengths[incLengths.length-1]))
	}

	const injectInclude = (m: SourceMap, parentUri: Uri, sourceLine: number, incLine: number, dbgLine: number) => {
		const inc = includes.find((inc) => inc.srcUri.fsPath === parentUri.fsPath && inc.srcLine === incLine)
		if (!inc) {
			// log.info('   no include found')
			return dbgLine
		}
		const incLen = incLengths.find((incLen) => incLen.incUri.fsPath === inc.incUri.fsPath)
		if (!incLen) {
			throw new Error('cannot find include length for ' + inc.incUri + ' [should not hit this!! (3)]')
		}
		for(let incLine=1; incLine<=incLen.lineCount; incLine++) {
			dbgLine++

			log.info('i=' + '?' + '; sourceLine=' + incLine + '; dbgLine=' + dbgLine + '; sourcePath=' + workspace.asRelativePath(incLen.incUri))
			m.items.push(new SourceMapItem({
				debugUri: parentUri,
				debugLine: dbgLine,
				sourceUri: incLen.incUri,
				sourceLine: incLine,
				procName: '', // TBD
			}))
			dbgLine = injectInclude(m, incLen.incUri, sourceLine, incLine, dbgLine)
		}
		return dbgLine
	}

	const getIncludesFromXref = (xrefUri: Uri) => {
		const incRE = /(\S+) (\S+) (\d+) ([A-Z-_"]+)\s+(.*)/
		log.info('xrefUri=' + xrefUri.fsPath)
		const lines = FileUtils.readLinesFromFileSync(xrefUri)

		if (!lines) {
			log.warn('cannot read xref: ' + xrefUri.fsPath)
		} else {
			log.info('parseXref lines.length=' + lines.length)
			for (const line of lines) {
				log.info('line="' + line + '"')
				const xref = incRE.exec(line)

				if (!xref || xref.length < 5 || xref[4] != 'INCLUDE') {
					continue
				}

				const [, path, ,lineNumStr, ,includeNameRaw] = xref

				const uri = Uri.file(path)
				let pinfo
				if (FileUtils.doesFileExist(uri)) {
					pinfo = propath.search(uri)
				} else {
					pinfo = propath.search(path)
				}

				const lineNum = Number(lineNumStr)
				const includeName = includeNameRaw.replace(/^"(.*)"$/, '$1').trim()
				const incinfo = propath.search(includeName)
				if (pinfo && incinfo) {
					includes.push({incUri: incinfo.uri, srcUri: pinfo.uri, srcLine: lineNum})
					readIncludeLineCount(incinfo.uri)
				}
			}
		}
	}

	const importDebugLines = (sourcePath: string, debugSourceUri: Uri,  xrefUri: Uri) => {
		let m: SourceMap | undefined = map.find((i) => i.sourceUri.fsPath == debugSourceUri.fsPath)
		if (!m) {
			m = {
				path: sourcePath,
				sourceUri: debugSourceUri,
				items: [],
			}
			map.push(m)
		}

		// This reads the xref to find where the include files belong, and finds how many lines each of those includes contain
		// It is is prone to error, especially in cases of multiple line arguments or include declarations.
		// Ideally we will parse the rcode for the source map, but this is a fallback option.
		getIncludesFromXref(xrefUri)

		const content = FileUtils.readLinesFromFileSync(debugSourceUri)
		if (content[content.length-1] == '') {
			content.pop()
		}

		lineCount = content.length
		log.info('lineCount=' + lineCount)

		let dbgLine = 0
		for (let i=1; i<=lineCount; i++) {
			dbgLine++

			log.info('i=' + i + '; sourceLine=' + i + '; dbgLine=' + dbgLine + '; sourcePath=' + workspace.asRelativePath(sourcePath))
			m.items.push(new SourceMapItem({
				debugLine: dbgLine,
				debugUri: debugSourceUri,
				sourceLine: i,
				sourceUri: debugSourceUri,
				procName: '' // TBD
			}))
			dbgLine = injectInclude(m, m.sourceUri, i, i, dbgLine)
		}
		return m
	}

	const getSourceMap = (debugSource: string) => {
		// check for previously parsed source map
		const fileinfo = propath.search(debugSource)
		if (!fileinfo) {
			throw new Error('cannot find file in propath: ' + debugSource)
		}

		// import the source map and return it
		const debugLines = importDebugLines(debugSource, fileinfo.uri, fileinfo.xrefUri)
		return debugLines
	}

	return getSourceMap(debugSource)
}
