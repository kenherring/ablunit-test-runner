import * as vscode from 'vscode'
import { ABLTestSuiteClass, ABLTestClassNamespace, ABLTestClass, ABLTestProgram, ABLTestMethod, ABLTestProcedure, testData, resultData } from './testTree'
import { outputChannel } from './ABLUnitCommon'
import { ABLResults } from './ABLResults'

const backgroundExecutable = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255,0,0,0.1)',
  })
const backgroundExecuted = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(0,255,0,0.1)',
})

let recentResults: ABLResults | undefined

export async function activate(context: vscode.ExtensionContext) {

	console.log("ACTIVATE!")
	outputChannel.appendLine("ACTIVATE!")

	const ctrl = vscode.tests.createTestController('ablunitTestController', 'ABLUnit Test')

	context.subscriptions.push(ctrl)
	context.subscriptions.push(
		vscode.commands.registerCommand('_ablunit.openCallStackItem', openCallStackItem),
		vscode.window.onDidChangeActiveTextEditor(e => decorate(e!) ),
		vscode.workspace.onDidOpenTextDocument(updateNodeForDocument),
		vscode.workspace.onDidChangeTextDocument(e => updateNodeForDocument(e.document)),
	)

	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>()

	const runHandler = (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) => {
		if (!request.continuous) {
			return startTestRun(request)
		}

		const l = fileChangedEmitter.event(uri => startTestRun(
			new vscode.TestRunRequest(
				[getOrCreateFile(ctrl, uri).file!],
				undefined,
				request.profile,
				true
			)
		))
		cancellation.onCancellationRequested(() => l.dispose())
	}

	const startTestRun = (request: vscode.TestRunRequest) => {

		let res: ABLResults
		try {
			res = new ABLResults(context.storageUri!)
		} catch (err) {
			vscode.window.showErrorMessage("Could not start test run. " + err)
			outputChannel.appendLine("Could not start test run. " + err)
			console.log("Could not start test run. " + err)
			return
		}
		showNotification("running ablunit tests")

		const queue: { test: vscode.TestItem; data: ABLTestClass | ABLTestSuiteClass | ABLTestClassNamespace | ABLTestMethod | ABLTestProgram | ABLTestProcedure }[] = []
		const run = ctrl.createTestRun(request)
		console.log('created testRun')
		resultData.set(run, res)

		console.log('created resultData')

		const discoverTests = async (tests: Iterable<vscode.TestItem>) => {
			for (const test of tests) {
				if (request.exclude?.includes(test)) {
					continue
				}

				const data = testData.get(test)
				printDataType(data)

				if (data instanceof ABLTestClass || data instanceof ABLTestProgram || data instanceof ABLTestMethod || data instanceof ABLTestProcedure || data instanceof ABLTestMethod) {
					run.enqueued(test)
					queue.push({ test, data })
				} else {
					await discoverTests(gatherTestItems(test.children))
				}
			}
		}

		const runTestQueue = async () => {
			for (const { test, data } of queue) {
				run.appendOutput(`running ${test.id}\r\n`)
				if (run.token.isCancellationRequested) {
					run.skipped(test)
				} else {
					run.started(test)
					await data.run(test, run)
				}
				run.appendOutput(`completed ${test.id}\r\n`)
			}

			run.end()
			recentResults = resultData.get(run)

			if (vscode.window.activeTextEditor)
				decorate(vscode.window.activeTextEditor)

			showNotification("ablunit tests complete")
		}

		res.start().then(() => {
			discoverTests(request.include ?? gatherTestItems(ctrl.items)).then(
				runTestQueue
			)
		})
	}

	ctrl.refreshHandler = async () => {
		await Promise.all(getWorkspaceTestPatterns().map(({ includePattern, excludePattern }) => findInitialFiles(ctrl, includePattern, excludePattern)))
	}

	ctrl.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, false, new vscode.TestTag("runnable"), false)
	// ctrl.createRunProfile('Debug Tests', vscode.TestRunProfileKind.Debug, runHandler, false, new vscode.TestTag("runnable"), false)

	ctrl.resolveHandler = async item => {
		if (!item) {
			context.subscriptions.push(...startWatchingWorkspace(ctrl, fileChangedEmitter))
			return
		}
		const data = testData.get(item)
		if (data instanceof ABLTestClass || data instanceof ABLTestProgram) {
			await data.updateFromDisk(ctrl, item)
		}
	}

	function updateNodeForDocument(e: vscode.TextDocument) {
		const openEditors = vscode.window.visibleTextEditors.filter(editor => editor.document.uri === e.uri)
		openEditors.forEach(editor => { decorate(editor) })

		if (e.uri.scheme !== 'file') { return }
		if (!e.uri.path.endsWith('.cls') && !e.uri.path.endsWith('.p')) { return }

		const { file, data } = getOrCreateFile(ctrl, e.uri)
		if (file) {
			data.updateFromContents(ctrl, e.getText(), file)
		}
	}
}

function getOrCreateFile(controller: vscode.TestController, uri: vscode.Uri) {
	const existing = controller.items.get(uri.toString())
	if (existing) {
		const data = testData.get(existing)
		if (data instanceof ABLTestClass) {
			return { file: existing, data: data }
		} else {
			return { file: existing, data: data as ABLTestProgram }
		}
	}

	//TODO: this is a hack to prevent the builder from trying to parse the ablunit files.  this should use the exclude pattern instead
	if (uri.toString().indexOf("/.builder/") != -1 || uri.toString().indexOf("/.oe/") != -1) {
		return { file: undefined, data: undefined }
	}

	const file = controller.createTestItem(uri.toString(), vscode.workspace.asRelativePath(uri.fsPath), uri)
	file.tags = [ new vscode.TestTag("runnable") ]
	controller.items.add(file)
	const data = createTopNode(file)
	testData.set(file, data)
	file.canResolveChildren = true
	return { file, data }
}

function createTopNode(file: vscode.TestItem) {
	if (file.uri?.toString().endsWith(".cls")) {
		return new ABLTestClass()
	} else if (file.uri?.toString().endsWith(".p")) {
		return new ABLTestProgram()
	}
	throw(new Error("invalid file extension. file='" + file.uri?.toString))
}

function gatherTestItems(collection: vscode.TestItemCollection) {
	const items: vscode.TestItem[] = []
	collection.forEach(item => items.push(item))
	return items
}

function getWorkspaceTestPatterns() {
	if (!vscode.workspace.workspaceFolders) { return [] }

	return vscode.workspace.workspaceFolders.map(workspaceFolder => ({
		workspaceFolder,
		includePattern: new vscode.RelativePattern(workspaceFolder, vscode.workspace.getConfiguration("ablunit").get("files.include") ?? ''),
		excludePattern: new vscode.RelativePattern(workspaceFolder, vscode.workspace.getConfiguration("ablunit").get("files.exclude") ?? '')
	}))
}

async function findInitialFiles(controller: vscode.TestController, includePattern: vscode.GlobPattern, excludePattern: vscode.GlobPattern) {
	const findAllFilesAtStartup = vscode.workspace.getConfiguration('ablunit').get('findAllFilesAtStartup')

	if (findAllFilesAtStartup) {
		for (const wsFile of await vscode.workspace.findFiles(includePattern, excludePattern)) {
			const { file, data } = getOrCreateFile(controller, wsFile)
			if(file) {
				await data.updateFromDisk(controller, file)
			}
		}
	}
}

function startWatchingWorkspace(controller: vscode.TestController, fileChangedEmitter: vscode.EventEmitter<vscode.Uri> ) {
	return getWorkspaceTestPatterns().map(({ workspaceFolder, includePattern, excludePattern }) => {
		const watcher = vscode.workspace.createFileSystemWatcher(includePattern)

		watcher.onDidCreate(uri => {
			getOrCreateFile(controller, uri)
			fileChangedEmitter.fire(uri)
		})
		watcher.onDidChange(async uri => {
			const { file, data } = getOrCreateFile(controller, uri)
			if (data?.didResolve) {
				await data.updateFromDisk(controller, file)
			}
			fileChangedEmitter.fire(uri)
		})
		watcher.onDidDelete(uri => controller.items.delete(uri.toString()))

		findInitialFiles(controller, includePattern, excludePattern)

		return watcher
	})
}

function decorate(editor: vscode.TextEditor) {
	const executedArray: vscode.DecorationOptions[] = []
	const executableArray: vscode.DecorationOptions[] = []

	if(!recentResults) { return }

	const tc = recentResults.testCoverage.get(editor.document.uri.fsPath)
	if (!tc) { return }
	tc.detailedCoverage?.forEach(element => {
		const range = <vscode.Range> element.location
		const decoration = { range }
		if (element.executionCount > 0) {
			executedArray.push(decoration)
		} else {
			executableArray.push(decoration)
		}
	})

	editor.setDecorations(backgroundExecuted, executedArray)
	editor.setDecorations(backgroundExecutable, executableArray)
}

function openCallStackItem(traceUriStr: string) {
	const traceUri = vscode.Uri.parse(traceUriStr.split("&")[0])
	const traceLine = Number(traceUriStr.split("&")[1])
	vscode.window.showTextDocument(traceUri).then(editor => {
		const lineToGoBegin = new vscode.Position(traceLine,0)
		const lineToGoEnd = new vscode.Position(traceLine + 1,0)
		editor.selections = [new vscode.Selection(lineToGoBegin, lineToGoEnd)]
		const range = new vscode.Range(lineToGoBegin, lineToGoEnd)
		decorate(editor)
		editor.revealRange(range)
	})
}

function showNotification(message: string) {
	if (vscode.workspace.getConfiguration('ablunit').get('notificationsEnabled', true)) {
		vscode.window.showInformationMessage(message)
	}
}

////////// DEBUG FUNCTIONS //////////

function printDataType(data: any) {
	if(data instanceof ABLTestSuiteClass)
		console.log(" - ABLTestSuite")
	else if(data instanceof ABLTestClassNamespace)
		console.log(" - ABLTestClassNamespace")
	else if(data instanceof ABLTestClass)
		console.log(" - ABLTestClass")
	else if(data instanceof ABLTestMethod)
		console.log(" - ABLTestMethod")
	else if(data instanceof ABLTestProgram)
		console.log(" - ABLTestProgram")
	else if(data instanceof ABLTestProcedure)
		console.log(" - ABLTestProcedure")
}
