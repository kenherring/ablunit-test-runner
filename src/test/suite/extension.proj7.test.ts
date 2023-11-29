import * as vscode from 'vscode'
import * as assert from 'assert'
import { before } from 'mocha'
import { getTestCount } from '../common'
// import { exec } from "child_process"

const projName = 'proj0'

function getUri (path: string) {
	return vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, path)
}

before(async () => {
	const templateProc = vscode.Uri.joinPath(getUri('src/template_proc.p'))
	const templateClass = vscode.Uri.joinPath(getUri('src/template_class.cls'))
	const classContent = await vscode.workspace.fs.readFile(templateClass).then((data) => {
		return data.toString()
	})

	for (let i = 0; i < 10; i++) {
		await vscode.workspace.fs.createDirectory(getUri('src/procs/dir' + i))
		await vscode.workspace.fs.createDirectory(getUri('src/classes/dir' + i))
		for (let j = 0; j < 10; j++) {
			await vscode.workspace.fs.copy(templateProc, getUri(`src/procs/dir${i}/testProc${j}.p`), { overwrite: true })

			const writeContent = Uint8Array.from(Buffer.from(classContent.replace(/template_class/, `classes.dir${i}.testClass${j}`)))
			await vscode.workspace.fs.writeFile(getUri(`src/classes/dir${i}/testClass${j}.cls`), writeContent)
		}
	}

	// await new Promise<string>((resolve, reject) => {
	// 	exec('git init && git add .', { cwd: vscode.workspace.workspaceFolders![0].uri.fsPath }, (err: any, stdout: any, stderr: any) => {
	// 		console.log("cp.exec complete?")
	// 		if (stdout) {
	// 			console.log("add stdout=" + stdout)
	// 		}
	// 		if (stderr) {
	// 			console.log("add stderr=" + stderr)
	// 		}
	// 		if (err) {
	// 			console.log("add err=" + err.toString(), 'error')
	// 		}
	// 		console.log("resolve add promise")
	// 		resolve("resolve add promise")
	// 	})
	// })
	// console.log("BEFORE END")
})

suite('SourceParser Test Suite - proj7', () => {

	test('testCount', async () => {
		await vscode.commands.executeCommand('testing.refreshTests')
		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		const resultsJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'temp','results.json')
		const testCount = await getTestCount(resultsJson)
		console.log("getTestCount: " + testCount)
		assert(testCount > 1000, "testCount should be > 100, but is " + testCount)
	})

})
