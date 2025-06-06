import { commands, Uri } from 'vscode'
import { assert, getXrefCount, log, sleep, toUri } from '../testCommon'
import { PropathParser } from 'ABLPropath'
import { SourceMapItem } from 'parse/SourceMapParser'
import { getSourceMapFromXref } from 'parse/SourceMapXrefParser'
import * as FileUtils from 'FileUtils'

suiteSetup('suiteSetup', () => {
	log.info('delete xref files')
	FileUtils.deleteFile(toUri('test_1/test.p.xref'))
	FileUtils.deleteFile(toUri('test_2/test.p.xref'))
	FileUtils.deleteFile(toUri('test_3/test.p.xref'))
	log.info('ant compile-and-test')
	return commands.executeCommand('workbench.action.tasks.build')
		.then(() => {
			log.info('ant compile-and-test done')
			return
		}, (e: unknown) => {
			log.error('error compiling! (e=' + e + ')')
			throw e
		})
})

setup('setup', async () => {
	log.info('setup ----- start')
	while (getXrefCount() < 3) {
		await sleep(100, 'waiting for test_1/test.p.xref')
	}
})

test('SourceMapXrefParser.test_1', () => {
	const propath = new PropathParser()
	log.info('propath=' + JSON.stringify(propath.propath, null, 2))

	const testuri = toUri('test_1/test.p')
	const incuri = toUri('test_1/include.i')
	const sourceMap = getSourceMap(propath, testuri)

	for (const item of sourceMap.items) {
		log.info('item=' + JSON.stringify(item, null, 2))
	}

	assert.equal(sourceMap.items.length, getLineCount(toUri('.dbg/test_1/test.p')))
	// validate the first executable line is number 4
	assertLines([sourceMap.items[0]], 1, 1, testuri, testuri)
	assertLines(sourceMap.items, 6, 6, testuri, testuri)
	assertLines(sourceMap.items, 7, 1, testuri, incuri)
	assertLines(sourceMap.items, 8, 2, testuri, incuri)
	assertLines(sourceMap.items, 9, 3, testuri, incuri)
	assertLines(sourceMap.items, 10, 4, testuri, incuri)
	assertLines(sourceMap.items, 11, 7, testuri, testuri)
	assertLines(sourceMap.items, 12, 8, testuri, testuri)
	assertLines(sourceMap.items, 13, 9, testuri, testuri)
	return
})

test('SourceMapXrefParser.test_2', () => {
	const propath = new PropathParser()
	log.info('propath=' + JSON.stringify(propath.propath, null, 2))

	const testuri = toUri('test_2/test.p')
	const incuri = toUri('test_2/include.i')
	const sourceMap = getSourceMap(propath, testuri)
	assert.equal(sourceMap.items.length, getLineCount(toUri('.dbg/test_2/test.p')))
	assertLines(sourceMap.items, 6, 6, testuri, testuri)
	assertLines(sourceMap.items, 7, 1, testuri, incuri)
	assertLines(sourceMap.items, 8, 2, testuri, incuri)
	assertLines(sourceMap.items, 9, 3, testuri, incuri)
	assertLines(sourceMap.items, 10, 4, testuri, incuri)
	assertLines(sourceMap.items, 11, 7, testuri, testuri)
	return
})

test('SourceMapXrefParser.test_3', () => {
	const propath = new PropathParser()
	log.info('propath=' + JSON.stringify(propath.propath, null, 2))

	const testuri = toUri('test_3/test.p')
	const incuri = toUri('test_3/include.i')
	const sourceMap = getSourceMap(propath, testuri)
	assert.equal(sourceMap.items.length, getLineCount(toUri('.dbg/test_3/test.p')))
	assertLines(sourceMap.items, 6, 6, testuri, testuri)
	assertLines(sourceMap.items, 7, 1, testuri, incuri)
	assertLines(sourceMap.items, 8, 2, testuri, incuri)
	assertLines(sourceMap.items, 9, 3, testuri, incuri)
	assertLines(sourceMap.items, 10, 4, testuri, incuri)
	assertLines(sourceMap.items, 11, 5, testuri, incuri)
	assertLines(sourceMap.items, 12, 7, testuri, testuri)
	return
})

function getSourceMap (propath: PropathParser, uri: Uri) {
	const sourceMap = getSourceMapFromXref(propath, uri.fsPath)
	if (!sourceMap) {
		throw new Error('no source map found')
	}
	return sourceMap
}

function getLineCount (uri: Uri) {
	const lines = FileUtils.readLinesFromFileSync(uri)
	if (lines[lines.length - 1] == '') {
		return lines.length - 1
	}
	return lines.length
}

function assertLines (lines: SourceMapItem[], dbgLine: number, srcLine: number, dbgUri?: Uri, srcUri?: Uri) {
	const filteredLines = lines.filter((l) => l.debugLine === dbgLine)
	if (!filteredLines) {
		assert.fail('lines not found ' + dbgUri?.fsPath + ':' + dbgLine)
		return
	}
	if (filteredLines.length > 1) {
		assert.fail('multiple lines found ' + dbgUri?.fsPath + ':' + dbgLine)
		return
	}
	const line = filteredLines[0]

	log.debug('line=' + JSON.stringify(line, null, 2))

	assert.equal(line.debugLine, dbgLine, 'lines.debugLine ' + line.debugLine + ' != ' + dbgLine) // always true
	assert.equal(line.sourceLine, srcLine, 'lines.sourceLine ' + line.sourceLine + ' != ' + srcLine + '(dbgLine=' + dbgLine + ')')
	if (dbgUri) {
		assert.equal(line.debugUri.fsPath, dbgUri.fsPath, 'lines.debugUri (dbgLine=' + dbgLine + ')')
	}
	if (srcUri) {
		assert.equal(line.sourceUri.fsPath, srcUri.fsPath, 'lines.sourceUri (dbgLine=' + dbgLine + ')')
	}
}
