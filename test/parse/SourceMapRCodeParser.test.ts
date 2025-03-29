import { commands, Uri } from 'vscode'
import { assert, log, sleep2, toUri } from '../testCommon'
import { PropathParser } from 'ABLPropath'
import { SourceMapItem } from 'parse/SourceMapParser'
import { getSourceMapFromRCode } from 'parse/SourceMapRCodeParser'
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

setup('setup', () => {
	log.info('setup ----- start')
})

test('SourceMapRCodeParser.test_0', async () => {
	log.info('SourceMapRCodeParser.test_0: start')
	const propath = new PropathParser()
	log.info('propath=' + JSON.stringify(propath.propath, null, 2))

	const testuri = toUri('test_0/test.p')
	const sourceMap = await getSourceMap(propath, toUri('test_0/test.r'))

	for (const item of sourceMap.items) {
		log.info('item=' + JSON.stringify(item, null, 2))
	}

	assert.equal(sourceMap.items.length, 1)
	// validate the first executable line is number 2
	assertLines(sourceMap.items, 2, 2, testuri, testuri)
	return
})

test('SourceMapRCodeParser.test_1', async () => {
	log.info('SourceMapRCodeParser.test_1: start')

	while (!FileUtils.doesFileExist(toUri('test_1/test.p.xref'))) {
		await sleep2(250, 'waiting for test_1/test.p.xref')
	}

	const propath = new PropathParser()
	log.info('propath=' + JSON.stringify(propath.propath, null, 2))

	const testuri = toUri('test_1/test.p')
	const incuri = toUri('test_1/include.i')
	const sourceMap = await getSourceMap(propath, toUri('test_1/test.r'))

	for (const item of sourceMap.items) {
		log.info('item=' + JSON.stringify(item, null, 2))
	}

	assert.equal(sourceMap.items.length, 8)
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

test('SourceMapRCodeParser.test_2', async () => {
	const propath = new PropathParser()
	log.info('propath=' + JSON.stringify(propath.propath, null, 2))

	const testuri = toUri('test_2/test.p')
	const incuri = toUri('test_2/include.i')
	const sourceMap = await getSourceMap(propath, testuri)
	assert.equal(sourceMap.items.length, getLineCount(toUri('.dbg/test_2/test.p')))
	assertLines(sourceMap.items, 6, 6, testuri, testuri)
	assertLines(sourceMap.items, 7, 1, testuri, incuri)
	assertLines(sourceMap.items, 8, 2, testuri, incuri)
	assertLines(sourceMap.items, 9, 3, testuri, incuri)
	assertLines(sourceMap.items, 10, 4, testuri, incuri)
	assertLines(sourceMap.items, 11, 7, testuri, testuri)
	return
})

test('SourceMapRCodeParser.test_3', async () => {
	const propath = new PropathParser()
	log.info('propath=' + JSON.stringify(propath.propath, null, 2))

	const testuri = toUri('test_3/test.p')
	const incuri = toUri('test_3/include.i')
	const sourceMap = await getSourceMap(propath, testuri)
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

test('SourceMapRCodeParser.test_4', async () => {
	log.info(' ---------- SourceMapRCodeParser.test_4: start ----------')
	const propath = new PropathParser()
	log.info('propath=' + JSON.stringify(propath.propath, null, 2))

	const testuri = toUri('test_4/destructorSimple.cls')
	log.info('testuri=' + testuri.fsPath)
	const sourceMap = await getSourceMap(propath, testuri).then((sourceMap) => {
		log.info('sourceMap.items.length=' + sourceMap.items.length)
		log.info('sourceMap.crc=' + sourceMap.crc)

		for (const d of sourceMap.declarations) {
			log.info('Declaration: ' + JSON.stringify(d))
		}

		return sourceMap
	}, (e: unknown) => {
		if (e instanceof Error) {
			log.error('Error in test_4: e=' + e.message)
		} else {
			log.error('error in test_4: e=' + e) // for non-error objects, just print it out
		}
		throw e
	})

	assertLines(sourceMap.items, 7, 7, testuri, testuri)
	return
})

async function getSourceMap (propath: PropathParser, uri: Uri) {
	const sourceMap = await getSourceMapFromRCode(propath, uri)
	if (!sourceMap) {
		throw new Error('no source map found')
	}
	return sourceMap
}

function getLineCount (uri: Uri) {
	const lines = FileUtils.readLinesFromFileSync(uri)
	log.info('lines.length=' + lines.length + ' uri=' + uri.fsPath)
	log.info('lines[' + lines.length + ']="' + lines[lines.length - 1] + '"')
	if (lines[lines.length - 1] == '') {
		log.info('returning ' + (lines.length - 1))
		return lines.length - 1
	}
	log.info('returning ' + lines.length)
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
