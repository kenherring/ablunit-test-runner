import { strict as assert } from 'assert'
import { before } from 'mocha'
import { Uri, workspace } from 'vscode'
import { getTestCount, getWorkspaceUri, runAllTests, waitForExtensionActive } from '../testCommon'

const projName = 'proj7A'
const workspaceUri = getWorkspaceUri()

function getUri (path: string) {
	return Uri.joinPath(workspaceUri, path)
}

before(async () => {
	await waitForExtensionActive()
	const templateProc = Uri.joinPath(getUri('src/template_proc.p'))
	const templateClass = Uri.joinPath(getUri('src/template_class.cls'))
	const classContent = await workspace.fs.readFile(templateClass).then((data) => {
		return data.toString()
	})

	for (let i = 0; i < 10; i++) {
		await workspace.fs.createDirectory(getUri('src/procs/dir' + i))
		await workspace.fs.createDirectory(getUri('src/classes/dir' + i))
		for (let j = 0; j < 10; j++) {
			await workspace.fs.copy(templateProc, getUri(`src/procs/dir${i}/testProc${j}.p`), { overwrite: true })

			const writeContent = Uint8Array.from(Buffer.from(classContent.replace(/template_class/, `classes.dir${i}.testClass${j}`)))
			await workspace.fs.writeFile(getUri(`src/classes/dir${i}/testClass${j}.cls`), writeContent)
		}
	}
})

suite(projName + ' - Extension Test Suite', () => {

	test(projName + '.1 - test count', async () => {
		await runAllTests()

		const resultsJson = Uri.joinPath(workspaceUri,'temp','results.json')
		const testCount = await getTestCount(resultsJson)
		assert(testCount > 1000, "testCount should be > 100, but is " + testCount)
	})

})
