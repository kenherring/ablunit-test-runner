import * as assert from 'assert'
import { copyFileSync, existsSync } from 'fs'
import { afterEach, before } from 'mocha'
import { FileType, Uri, commands, extensions, workspace } from 'vscode'

before(async () => {
	console.log("activating extension: kherring.ablunit-test-runner")
	const ext = extensions.getExtension('kherring.ablunit-test-runner')
	if (!ext) {
		throw new Error("extension not found: kherring.ablunit-test-runner")
	}

	await ext.activate().then(async () => {
		console.log("extension activated!")
	}, (err) => {
		throw new Error("failed to activate extension: " + err)
	})
	console.log("before complete!")
})

afterEach(async () => {
	await restoreTestProfile()
})

suite('install and run', () => {

	test("install and run - does package extension work?", async () => {
		await updateTestProfile('tempDir', 'target')
		await runAllTests()

		const workspaceFolder = getWorkspaceUri()
		const ablunitJson = Uri.joinPath(workspaceFolder, 'target', 'ablunit.json')
		const resultsXml = Uri.joinPath(workspaceFolder, 'target', 'results.xml')
		const resultsJson = Uri.joinPath(workspaceFolder, 'target', 'results.json')

		assert(existsSync(ablunitJson.fsPath), "missing ablunit.json (" + ablunitJson.fsPath + ")")
		assert(existsSync(resultsXml.fsPath), "missing results.xml (" + resultsXml.fsPath + ")")
		assert(existsSync(resultsJson.fsPath), "results.json exists and should not (" + resultsJson.fsPath + ")")
	})

})

function runAllTests () {
	return commands.executeCommand('testing.runAll').then(() => {
		console.log("testing.runAll complete!")
	} , (err) => {
		throw new Error("testing.runAll failed: " + err)
	})
}

function getWorkspaceUri () {
	return workspace.workspaceFolders![0].uri
}

function updateTestProfile (key: string, value: string | string[] | boolean) {
	console.log("100")
	const testProfileFile = Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json')
	console.log("reading test profile: " + testProfileFile.fsPath)

	return workspace.fs.readFile(testProfileFile).then((content) => {
		// can only use json without comments when testing here...
		let settings = JSON.parse(Buffer.from(content.buffer).toString())
		console.log("key: " + key + ", value: " + value + ", oldValue: " + settings['configurations'][0][key])
		settings['configurations'][0][key] = value
		createRestoreFile(testProfileFile)
		return workspace.fs.writeFile(testProfileFile, Buffer.from(JSON.stringify(settings, null, 2) + '\n')).then(() => {
			console.log("updated ablunit-test-profile.json")
		}, (err) => {
			console.log("error writing ablunit-test-profile.json: " + err)
			throw err
		})
	}, (err) => {
		console.log("error reading ablunit-test-profile.json: " + err)
		throw err
	})
}

function createRestoreFile (src: Uri) {
	const dest = Uri.file(src.fsPath + '.restore')
	if (!existsSync(dest.fsPath)) {
		console.log("creating restore file: " + dest.fsPath)
		copyFileSync(src.fsPath, dest.fsPath)
	}
}

function restoreTestProfile () {
	const settingsFile = Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json')
	const restoreFile = Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json.restore')
	console.log("restoring " + workspace.asRelativePath(settingsFile) + " from " + workspace.asRelativePath(restoreFile) + "...")
	return workspace.fs.rename(restoreFile, settingsFile, { overwrite: true })
}
