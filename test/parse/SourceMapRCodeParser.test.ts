import { commands, Uri } from 'vscode'
import { assert, log, sleep, toUri } from '../testCommon'
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
		.then(() => { return sleep(2500) })
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
	const sourceMap = await getSourceMap(propath, toUri('test_0/test.r'))
	assert.equal(sourceMap.items.length, 0) // compiled with MIN-SIZE=true so no source map
})

test('SourceMapRCodeParser.test_1', async () => {
	log.info('SourceMapRCodeParser.test_1: start')

	const propath = new PropathParser()
	const testuri = toUri('test_1/test.p')
	const incuri = toUri('test_1/include.i')
	const sourceMap = await getSourceMap(propath, toUri('test_1/test.r'))

	assert.equal(sourceMap.items.length, 8)

	// validate the first executable line is number 5
	assertLines([sourceMap.items[0]], 5, 5, testuri, testuri)
	assertLines(sourceMap.items, 7, 1, testuri, incuri)
	assertLines(sourceMap.items, 9, 3, testuri, incuri)
	assertLines(sourceMap.items, 14, 10, testuri, testuri)
	assertLines(sourceMap.items, 15, 11, testuri, testuri)
	assertLines(sourceMap.items, 17, 13, testuri, testuri)
	assertLines(sourceMap.items, 18, 14, testuri, testuri)
	assertLines(sourceMap.items, 19, 15, testuri, testuri)
	return
})

test('SourceMapRCodeParser.test_3', async () => {
	const testuri = toUri('test_3/test.p')
	const sourceMap = await getSourceMap(new PropathParser(), testuri).then((sourceMap) => {
		return sourceMap
	}, (e: unknown) => {
		log.info('Error in test_3: e=' + (e instanceof Error ? e.message : String(e)))
		throw e
	})

	assert.equal(sourceMap.declarations[0].procName, '')
	assert.equal(sourceMap.declarations[1].procName, 'NotATest')
	assert.equal(sourceMap.declarations[2].procName, 'test4')
	assert.equal(sourceMap.declarations[3].procName, 'test3.2')
	assert.equal(sourceMap.declarations[4].procName, 'test3.1')
	assert.equal(sourceMap.declarations[5].procName, 'test_proc')
})


test('SourceMapRCodeParser.test_4', async () => {
	const propath = new PropathParser()
	const testuri = toUri('test_4/destructorSimple.cls')
	const sourceMap = await getSourceMap(propath, testuri).then((sourceMap) => {
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

function assertLines (lines: SourceMapItem[], dbgLine: number, srcLine: number, dbgUri?: Uri, srcUri?: Uri) {
	const filteredLines = lines.filter((l) => l.debugLine === dbgLine)
	if (!filteredLines || filteredLines.length === 0) {
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
