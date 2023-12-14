import * as assert from 'assert'
import { before } from 'mocha'
import { FileType, Uri, commands, extensions, workspace } from 'vscode'

before(async () => {
	console.log("activating extension: kherring.ablunit-test-provider")
	const ext = extensions.getExtension('kherring.ablunit-test-provider')
	if (!ext) {
		throw new Error("extension not found: kherring.ablunit-test-provider")
	}

	await ext.activate().then(async () => {
		console.log("extension activated! setting tempDir to 'target'")
		await updateTestProfile('tempDir', 'target')
		console.log("tempDir set to 'target'")
	}, (err) => {
		throw new Error("failed to activate extension: " + err)
	})
	console.log("before complete!")
})

suite('install and run', () => {

	test("install and run - does package extension work?", async () => {
		await new Promise((resolve) => setTimeout(resolve, 1000))
		await runAllTests()

		const workspaceDir = workspace.workspaceFolders![0].uri

		const ablunitJson = Uri.joinPath(workspaceDir, 'target', 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceDir, 'target', 'results.xml')
		const resultsJson = Uri.joinPath(workspaceDir, 'target', 'results.json')

		console.log("storageUri= " + workspaceDir.fsPath)
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(!await doesFileExist(resultsJson), "results.json exists and should not (" + resultsJson.fsPath + ")")
	})

})

function runAllTests () {
	console.log("testing.runAll starting")
	return commands.executeCommand('testing.runAll').then(() => {
		console.log("testing.runAll complete!")
	} , (err) => {
		throw new Error("testing.runAll failed: " + err)
	})
}

async function doesFileExist(uri: Uri) {
	const ret = await workspace.fs.stat(uri).then((stat) => {
		if (stat.type === FileType.File) {
			return true
		}
		return false
	}, (err) => {
		console.error('failed to stat file: ' + uri.fsPath + ', err=' + err)
		return false
	})
	return ret
}

function getWorkspaceUri () {
	return workspace.workspaceFolders![0].uri
}

function updateTestProfile (key: string, value: string | string[] | boolean): Thenable<void> {
	console.log("workspaceDir = " + getWorkspaceUri().fsPath)
	return workspace.fs.readFile(Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json')).then((content) => {
		console.log("got content")
		let str = Buffer.from(content.buffer).toString()
		str = str.replace(/"tempDir": *".*"/, '"' + key + '": "' + value + '"')
		return workspace.fs.writeFile(Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json'), Buffer.from(str))
	}, (err) => {
		console.log("error reading ablunit-test-profile.json: " + err)
	})
}
