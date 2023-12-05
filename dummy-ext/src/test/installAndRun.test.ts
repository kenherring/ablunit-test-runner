import * as assert from 'assert'
import { time } from 'console'
import { before } from 'mocha'
import { ConfigurationTarget, FileType, Uri, commands, extensions, workspace } from 'vscode'

before(async () => {
	console.log("activating extension: kherring.ablunit-test-provider")
	const ext = extensions.getExtension('kherring.ablunit-test-provider')
	if (!ext) {
		throw new Error("extension not found: kherring.ablunit-test-provider")
	}

	await ext!.activate().then(() => {
		console.log("extension activated! setting tempDir to 'target'")
		return workspace.getConfiguration('ablunit').update('tempDir', 'target', ConfigurationTarget.Global).then(() => {
			console.log("tempDir set to 'target'")
		}, (err) => {
			throw new Error("failed to set tempDir to 'target': " + err)
		})
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


export async function runAllTests () {
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
		return false
	})
	return ret
}
