import { strict as assert } from 'assert'
import { before } from 'mocha'
import { Uri, commands, workspace } from 'vscode'
import { getDefaultDLC, getWorkspaceUri, setRuntimes, sleep, waitForExtensionActive } from '../testCommon'
import { getSourceMapFromRCode } from '../../parse/RCodeParser'
import { PropathParser } from '../../ABLPropath'
import { GlobSync } from 'glob'

const projName = 'DebugLines'
const workspaceFolder = workspace.workspaceFolders![0]

async function awaitRCode (rcodeCount: number = 1) {
	const buildWaitTime = 10
	console.log("ablunit rebuild started. waiting up to" + buildWaitTime + " seconds for r-code")
	for (let i = 0; i < buildWaitTime; i++) {
		await new Promise((resolve) => setTimeout(resolve, 1000))

		const g = new GlobSync('**/*.r', { cwd: workspaceFolder.uri.fsPath })
		console.log("(" + i + "/" + buildWaitTime + ") found " + g.found.length + " r-code files...")
		if (g.found.length > rcodeCount) {
			console.log("found " + g.found.length + " r-code files! ready to test")
			return
		}
		console.log("found " + g.found.length + " r-code files. waiting...")
		console.log("found files: " + JSON.stringify(g.found,null,2))
	}


	await commands.executeCommand('abl.dumpFileStatus').then(() => {
		console.log("abl.dumpFileStatus complete!")
	})
	await commands.executeCommand('abl.dumpLangServStatus').then(() => {
		console.log("abl.dumpLangServStatus complete!")
	})

	throw new Error("r-code files not found")
}

before(async () => {
	await waitForExtensionActive()
	console.log("getDefaultDLC=" + getDefaultDLC())
	await setRuntimes([{name: "12.2", path: getDefaultDLC(), default: true}])
	await commands.executeCommand('abl.project.rebuild').then(() => {
		console.log("abl project rebuild started")
		return sleep(500)
	})
	const waiting = awaitRCode(5)
	await waiting.then(() => {
		console.log("abl project rebuild complete!")
	})
})

suite(projName + ' - Extension Test Suite', () => {

	// test(projName + '.0 - DEBUG', () => {
	// 	assert.equal(true, true)
	// })

	test(projName + '.1 - read debug line map from r-code', async () => {
		const propath = new PropathParser(workspaceFolder)
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test1.r'))
		assert.equal(7, sourceMap.items.length)

		assert.equal("src/inc/unit_inc1.i", sourceMap.items[2].sourcePath)
		assert.equal(1, sourceMap.items[2].sourceLine)
		assert.equal(7, sourceMap.items[2].debugLine)

		assert.equal("src/code/unit_test1.p", sourceMap.items[6].sourcePath)
		assert.equal(10, sourceMap.items[6].sourceLine)
		assert.equal(13, sourceMap.items[6].debugLine)
	})

	test(projName + '.2 - read debug line map from r-code', async () => {
		const propath = new PropathParser(workspaceFolder)
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test2.r'))
		assert.equal(7, sourceMap.items.length)

		assert.equal("src/inc/unit_inc1.i", sourceMap.items[2].sourcePath)
		assert.equal(1, sourceMap.items[2].sourceLine)
		assert.equal(7, sourceMap.items[2].debugLine)

		assert.equal("src/code/unit_test2.p", sourceMap.items[6].sourcePath)
		assert.equal(11, sourceMap.items[6].sourceLine)
		assert.equal(15, sourceMap.items[6].debugLine)
	})

	test(projName + '.3 - read debug line map from r-code', async () => {
		const propath = new PropathParser(workspaceFolder)
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test3.r'))
		assert.equal(7, sourceMap.items.length)

		assert.equal("src/inc/unit_inc3.i", sourceMap.items[2].sourcePath)
		assert.equal(1, sourceMap.items[2].sourceLine)
		assert.equal(9, sourceMap.items[2].debugLine)

		assert.equal("src/code/unit_test3.p", sourceMap.items[6].sourcePath)
		assert.equal(12, sourceMap.items[6].sourceLine)
		assert.equal(15, sourceMap.items[6].debugLine)
	})

	test(projName + '.4 - read debug line map from r-code', async () => {
		const propath = new PropathParser(workspaceFolder)
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test4.r'))
		assert.equal(5, sourceMap.items.length)

		assert.equal("src/code/unit_test4.p", sourceMap.items[4].sourcePath)
		assert.equal(11, sourceMap.items[4].sourceLine)
		assert.equal(11, sourceMap.items[4].debugLine)
	})

	test(projName + '.5 - read debug line map for class from r-code', async () => {
		const propath = new PropathParser(workspaceFolder)
		const sourceMap = await getSourceMapFromRCode(propath, Uri.joinPath(getWorkspaceUri(), 'out/code/unit_test5.r'))
		assert.equal(9, sourceMap.items.length)

		// test_method_1
		assert.equal("src/code/unit_test5.cls", sourceMap.items[0].sourcePath, "sourcePath #0")
		assert.equal(4, sourceMap.items[0].sourceLine, "sourceLine #0")
		assert.equal(4, sourceMap.items[0].debugLine, "debugLine #0")

		// test_method_2
		assert.equal("src/code/unit_test5.cls", sourceMap.items[2].sourcePath, "sourcePath #2")
		assert.equal(8, sourceMap.items[2].sourceLine, "sourceLine #2")
		assert.equal(8, sourceMap.items[2].debugLine, "debugLine #2")

		assert.equal("src/inc/unit_inc5.i", sourceMap.items[3].sourcePath, "sourcePath #3")
		assert.equal(1, sourceMap.items[3].sourceLine, "sourceLine #3")
		assert.equal(10, sourceMap.items[3].debugLine, "debugLine #3")

		assert.equal("src/code/unit_test5.cls", sourceMap.items[7].sourcePath, "sourcePath #7")
		assert.equal(10, sourceMap.items[7].sourceLine, "sourceLine #7")
		assert.equal(22, sourceMap.items[7].debugLine, "debugLine #7")
	})

})
