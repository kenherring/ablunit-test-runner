import { strict as assert } from 'assert'
import { before } from 'mocha'
import { FileType, Uri, commands, extensions, workspace } from 'vscode'

suiteSetup(async () => {
	console.log("[before-1] activating extension: kherring.ablunit-test-runner")
	await commands.executeCommand('workbench.extensions.installExtension', process.env['EXTENSION_VSIX_PATH'])
	const ext = extensions.getExtension('kherring.ablunit-test-runner')
	if (!ext) {
		throw new Error("extension not found: kherring.ablunit-test-runner")
	}

	await updateTestProfileTempDir('target').then(() => { return sleep(100) })

	await ext.activate().then(async () => {
		console.log("[before-5] extension activated!'")
	}, (err) => {
		throw new Error("failed to activate extension: " + err)
	})
	console.log("before complete!")
})

suite('install and run', () => {

	test("install and run - does package extension work?", async () => {
		await runAllTests().then(() => {
			console.log("runAllTests complete!")
		}, (err) => { throw new Error("runAllTests failed: " + err) })

		const workspaceFolder = workspace.workspaceFolders![0].uri

		const ablunitJson = Uri.joinPath(workspaceFolder, 'target', 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceFolder, 'target', 'results.xml')
		const resultsJson = Uri.joinPath(workspaceFolder, 'target', 'results.json')

		console.log("workspaceFolder= " + workspaceFolder.fsPath)
		console.log("ablunitJson=" + ablunitJson.fsPath)
		assert(await doesFileExist(ablunitJson), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(await doesFileExist(resultsXml), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(await doesFileExist(resultsJson), "missing results.json (" + resultsJson.fsPath + ")")
	})

})

async function sleep (ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

async function refreshTests () {
	return commands.executeCommand('testing.refreshTests').then(() => {
		console.log("[installAndRun.test.ts runAllTests] testing.refreshTests complete!")
		return new Promise((resolve) => setTimeout(resolve, 500)).then((): boolean => {
			console.log("[installAndRun.test.ts runAllTests] done sleeping after refresh")
			return true
		})
	})
}

async function runAllTests () {
	console.log("[installAndRun.test.ts runAllTests] testing.runAll starting")

	return refreshTests().then((ret: boolean) => {
		if (!ret) {
			throw new Error("testing.refreshTests failed")
		}
		return commands.executeCommand('testing.runAll').then(() => {
			console.log("[installAndRun.test.ts runAllTests] testing.runAll complete!")
			return new Promise((resolve) => setTimeout(resolve, 500)).then(() => {
				console.log("[installAndRun.test.ts runAllTests] done sleeping after runAll")
				return true
			})
		} , (err) => {
			throw new Error("testing.runAll failed: " + err)
		})
	})
}

async function doesFileExist(uri: Uri) {
	return workspace.fs.stat(uri).then((stat) => {
		if (stat.type === FileType.File) {
			return true
		}
		throw new Error("not a file: " + uri.fsPath)
	}, (err) => {
		throw new Error("failed to stat file: " + uri.fsPath + ", err=" + err)
	})
}

function getWorkspaceUri () {
	return workspace.workspaceFolders![0].uri
}

function updateTestProfileTempDir (value: string | string[] | boolean): Thenable<void> {
	console.log("[installAndRun.test.ts updateTestProfile] workspaceFolder = " + getWorkspaceUri().fsPath)
	const testProfileUri = Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json')

	return workspace.fs.readFile(testProfileUri).then((content) => {
		console.log("[installAndRun.test.ts updateTestProfile] got content")
		let str = Buffer.from(content.buffer).toString()
		str = str.replace(/"tempDir": *".*"/, '"tempDir": "' + value + '"')
		return workspace.fs.writeFile(testProfileUri, Buffer.from(str)).then(() => {
			console.log("[installAndRun.test.ts updateTestProfile] wrote " + testProfileUri.fsPath + " successfully")
		})
	}, (err) => {
		throw new Error("error reading " + testProfileUri.fsPath + ": " + err)
	})
}
