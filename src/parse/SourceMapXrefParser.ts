import { Uri, workspace } from 'vscode'
import { PropathParser } from '../ABLPropath'
import { log } from '../ChannelLogger'
import * as FileUtils from 'FileUtils'
import { SourceMap, SourceMapItem } from './SourceMapParser'

interface IXrefInclude {
	incUri: Uri
	srcUri: Uri
	srcLine: number
}

interface IIncLength {
	incUri: Uri
	lineCount: number
}

export const getSourceMapFromXref = (propath: PropathParser, debugSourceName: string) => {
	const map: SourceMap[] = []
	const incLengths: IIncLength[] = []
	const includes: IXrefInclude[] = []
	const warnings: string[] = []
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
		return
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

	const getIncludesFromXref = async (xrefUri: Uri) => {
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

				if (xref) {
					log.info('xref.length=' + xref.length)
				}
				// log.warn('xref=' + JSON.stringify(xref))

				if (xref && xref.length >= 5 && xref[4] == 'INCLUDE') {
					log.info('xref=' + JSON.stringify(xref))
					const [, path, ,lineNumStr, ,includeNameRaw] = xref

					log.info('path=' + path)
					const uri = Uri.file(path)
					let pinfo
					if (FileUtils.doesFileExist(uri)) {
						log.info('pinfo seraching for uri=' + uri.fsPath)
						pinfo = await propath.search(uri)
					} else {
						log.info('pinfo seraching for path=' + path)
						pinfo = await propath.search(path)
					}

					const lineNum = Number(lineNumStr)
					const includeName = includeNameRaw.replace(/^"(.*)"$/, '$1').trim()
					const incinfo = await propath.search(includeName)
					log.info('pinfo=' + JSON.stringify(pinfo, null, 2))
					log.info('incInfo=' + JSON.stringify(incinfo, null, 2))
					if (pinfo && incinfo) {
						includes.push({incUri: incinfo.uri, srcUri: pinfo.uri, srcLine: lineNum})
						readIncludeLineCount(incinfo.uri)
					}
				}
			}
		}
	}

	const importDebugLines = async (sourcePath: string, debugSourceUri: Uri,  xrefUri: Uri) => {
		const m: SourceMap = {
			path: sourcePath,
			sourceUri: debugSourceUri,
			items: [],
		}
		map.push(m)

		// This reads the xref to find where the include files belong, and finds how many lines each of those includes contain
		// It is is prone to error, especially in cases of multiple line arguments or include declarations.
		// Ideally we will parse the rcode for the source map, but this is a fallback option.
		await getIncludesFromXref(xrefUri)

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

	const getSourceMap = async (debugSourceName: string) => {
		log.info('debugSourceName=' + debugSourceName)
		// check for previously parsed source map
		let debugLines = map.filter((dlm) => dlm.path === debugSourceName)
		if (debugLines && debugLines.length > 0) {
			log.info('debugLines found! debugLines.length=' + debugLines.length)
			if (debugLines.length > 1) {
				log.error('more than one source map found for ' + debugSourceName)
				throw new Error('more than one source map found for ' + debugSourceName)
			}
			return debugLines[0]
		}

		// find the source file in the propath
		log.info('searching for ' + debugSourceName)
		const fileinfo = await propath.search(debugSourceName)
		if (!fileinfo) {
			if (!debugSourceName.startsWith('OpenEdge.') && debugSourceName != 'ABLUnitCore.p') {
				if (!warnings.includes(debugSourceName)) {
					log.error('[getSourceMap] WARNING: cannot find ' + debugSourceName + ' in propath.')
					warnings.push(debugSourceName)
				}
			}
			return undefined
		}

		// import the source map and return it
		try {
			log.info('importDebugLines')
			log.info('  - debugSourceName=' + debugSourceName)
			log.info('  - fileinfo.uri=' + fileinfo.uri)
			log.info('  - fileinfo.xrefUri=' + fileinfo.xrefUri)
			debugLines = [await importDebugLines(debugSourceName, fileinfo.uri, fileinfo.xrefUri)]
		} catch (e: unknown) {
			log.warn('cannot find source map for ' + debugSourceName + ' (e=' + e + ')')
			return undefined
		}
		log.info('returning sourcemap for ' + debugSourceName)
		return debugLines[0]
	}

	return getSourceMap(debugSourceName)
}
