import * as vscode from 'vscode'
import { ABLTestSuite, ABLTestClass, ABLTestProgram, ABLTestMethod, ABLTestProcedure, testData, resultData } from './testTree'
import { logToChannel } from './ABLUnitCommon'
import { ABLResults } from './ABLResults'
import { resetAblunitConfig } from './ABLUnitConfigWriter'
import { readFileSync } from 'fs'

const backgroundExecutable = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255,0,0,0.1)',
  })
const backgroundExecuted = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(0,255,0,0.1)',
})

let recentResults: ABLResults | undefined
let storageUri: vscode.Uri | undefined = undefined

export function getStorageUri () {
	return storageUri
}

export async function activate(context: vscode.ExtensionContext) {

	logToChannel("ACTIVATE!")

	const debugEnabled = vscode.workspace.getConfiguration('ablunit').get('debugEnabled', false)
	const ctrl = vscode.tests.createTestController('ablunitTestController', 'ABLUnit Test')
	storageUri = context.storageUri

	context.subscriptions.push(ctrl)
	context.subscriptions.push(
		vscode.commands.registerCommand('_ablunit.openCallStackItem', openCallStackItem),
		vscode.window.onDidChangeActiveTextEditor(e => decorate(e!) ),
		vscode.workspace.onDidChangeConfiguration(e => updateConfiguration(ctrl, e) ),
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
				[getOrCreateFile(ctrl, uri).file],
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
			logToChannel("Could not start test run. " + err)
			return
		}
		showNotification("running ablunit tests")

		const queue: { test: vscode.TestItem; data: ABLTestSuite | ABLTestClass | ABLTestMethod | ABLTestProgram | ABLTestProcedure }[] = []
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
				if (debugEnabled) {
					printDataType(data)
				}

				if (data instanceof ABLTestSuite || data instanceof ABLTestClass || data instanceof ABLTestProgram || data instanceof ABLTestMethod || data instanceof ABLTestProcedure || data instanceof ABLTestMethod) {
					run.enqueued(test)
					queue.push({ test, data })
					await res.addTest(test.id)
				} else {
					await discoverTests(gatherTestItems(test.children))
				}
			}
		}

		const runTestQueue = async () => {
			for (const { test } of queue) {
				if (run.token.isCancellationRequested) {
					run.skipped(test)
				} else {
					run.started(test)
					for(const childTest of gatherTestItems(test.children)) {
						run.started(childTest)
					}
				}
			}

			res.setTestData(testData)
			logToChannel('starting ablunit run')
			run.appendOutput('starting ablunit run\r\n')

			const ret = await res.run(run).then(() => {
				return true
			}, (err) => {
				logToChannel("ablunit run failed with exception: " + err,'error')
				return false
			})

			if(!ret) {
				for (const { test } of queue) {
					run.errored(test,new vscode.TestMessage("ablunit run failed"))
					for (const childTest of gatherTestItems(test.children)) {
						run.errored(childTest,new vscode.TestMessage("ablunit run failed"))
					}
				}
				run.end()
				return
			}

			logToChannel('ablunit run complete')
			run.appendOutput('ablunit run complete\r\n')

			for (const { test } of queue) {
				if (run.token.isCancellationRequested) {
					run.skipped(test)
				} else {
					await res.assignTestResults(test, run)
				}
			}

			run.end()
			recentResults = resultData.get(run)

			if (vscode.window.activeTextEditor)
				decorate(vscode.window.activeTextEditor)

			showNotification("ablunit tests complete")
		}

		res.start().then(() => {
			res.resetTests()
			discoverTests(request.include ?? gatherTestItems(ctrl.items)).then(
				runTestQueue
			)
		})
	}

	ctrl.refreshHandler = async () => {
		await Promise.all(getWorkspaceTestPatterns().map(({ includePatterns, excludePatterns }) => findInitialFiles(ctrl, includePatterns, excludePatterns, true)))
	}

	ctrl.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, false, new vscode.TestTag("runnable"), false)
	// ctrl.createRunProfile('Debug Tests', vscode.TestRunProfileKind.Debug, runHandler, false, new vscode.TestTag("runnable"), false)

	ctrl.resolveHandler = async item => {
		if (!item) {
			context.subscriptions.push(...startWatchingWorkspace(ctrl, fileChangedEmitter))
			return
		}
		const data = testData.get(item)
		if (data instanceof ABLTestSuite || data instanceof ABLTestClass || data instanceof ABLTestProgram) {
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

	function updateConfiguration(controller: vscode.TestController, e: vscode.ConfigurationChangeEvent) {
		resetAblunitConfig()
		if (e.affectsConfiguration('ablunit')) {
			vscode.commands.executeCommand('testing.refreshTests')
		}
	}
}

function getOrCreateFile(controller: vscode.TestController, uri: vscode.Uri) {
	const existing = controller.items.get(uri.toString())
	if (existing) {
		const data = testData.get(existing)
		if (data instanceof ABLTestSuite) {
			return { file: existing, data: data }
		} else if (data instanceof ABLTestClass) {
			return { file: existing, data: data }
		} else if (data instanceof ABLTestProgram) {
			return { file: existing, data: data }
		} else {
			throw new Error("[getOrCreateFile] unexpected data type")
		}
	}

	isFileExcluded(uri,getExcludePatterns()).then(excluded => {
		if(excluded) {
			return { file: undefined, data: undefined }
		}
	})

	const file = controller.createTestItem(uri.toString(), vscode.workspace.asRelativePath(uri.fsPath), uri)
	file.tags = [ new vscode.TestTag("runnable") ]
	controller.items.add(file)
	const data = createTopNode(file)
	testData.set(file, data)
	file.canResolveChildren = true
	return { file, data }
}

function createTopNode(file: vscode.TestItem) {
	const isSuite = isTestSuite(file.uri)

	if (isSuite) {
		return new ABLTestSuite()
	}
	if (file.uri?.toString().endsWith(".cls")) {
		return new ABLTestClass()
	}
	return new ABLTestProgram()
}

function isTestSuite(file: vscode.Uri | undefined) {
	if (!file) { return false }
	const suiteRegex = /@testsuite/i
	const contents = readFileSync(file.fsPath).toString()
	return suiteRegex.test(contents)
}

function gatherTestItems(collection: vscode.TestItemCollection) {
	const items: vscode.TestItem[] = []
	collection.forEach(item => items.push(item))
	return items
}

function getExcludePatterns() {
	let excludePatterns: string[] = []

	const excludePatternsConfig: string[] | undefined = vscode.workspace.getConfiguration("ablunit").get("files.exclude")
	if (!excludePatternsConfig) {
		excludePatterns = [ "**/.builder/**" ]
	} else if (excludePatternsConfig[0].length == 1) {
		excludePatterns[0] = ''
		for (const pattern of excludePatternsConfig) {
			excludePatterns[0] = excludePatterns[0] + pattern
		}
	} else {
		excludePatterns = excludePatternsConfig
	}
	let retVal: vscode.RelativePattern[] = []

	vscode.workspace.workspaceFolders!.map(workspaceFolder => {
		retVal = retVal.concat(excludePatterns.map(pattern => new vscode.RelativePattern(workspaceFolder, pattern)))
	})
	return retVal
}

function getWorkspaceTestPatterns() {
	let includePatterns: string[] = []
	let excludePatterns: string[] = []

	const includePatternsConfig: string[] | undefined = vscode.workspace.getConfiguration("ablunit").get("files.include")
	if (!includePatternsConfig) {
		includePatterns = [ "**/*.{cls,p}" ]
	} else if (includePatternsConfig[0].length == 1) {
		includePatterns[0] = ''
		for (const pattern of includePatternsConfig) {
			includePatterns[0] = includePatterns[0] + pattern
		}
	} else {
		includePatterns = includePatternsConfig
	}

	const excludePatternsConfig: string[] | undefined = vscode.workspace.getConfiguration("ablunit").get("files.exclude")
	if (!excludePatternsConfig) {
		excludePatterns = [ "**/.builder/**" ]
	} else if (excludePatternsConfig[0].length == 1) {
		excludePatterns[0] = ''
		for (const pattern of excludePatternsConfig) {
			excludePatterns[0] = excludePatterns[0] + pattern
		}
	} else {
		excludePatterns = excludePatternsConfig
	}

	return vscode.workspace.workspaceFolders!.map(workspaceFolder => ({
		workspaceFolder,
		includePatterns: includePatterns.map(pattern => new vscode.RelativePattern(workspaceFolder, pattern)),
		excludePatterns: excludePatterns.map(pattern => new vscode.RelativePattern(workspaceFolder, pattern))
	}))
}

async function removeExcludedFiles(controller: vscode.TestController, excludePatterns: vscode.RelativePattern[]) {
	for (const item of gatherTestItems(controller.items)) {
		if (item.uri && await isFileExcluded(item.uri, excludePatterns)) {
			controller.items.delete(item.id)
		}
	}
}

async function findInitialFiles(controller: vscode.TestController, includePatterns: vscode.RelativePattern[], excludePatterns: vscode.RelativePattern[], removeExcluded: boolean = false) {
	const findAllFilesAtStartup = vscode.workspace.getConfiguration('ablunit').get('findAllFilesAtStartup')

	if (removeExcluded) {
		removeExcludedFiles(controller, excludePatterns)
	}

	if (!findAllFilesAtStartup) {
		return
	}
	for (const includePattern of includePatterns) {
		for (const wsFile of await vscode.workspace.findFiles(includePattern)) {
			const excluded = await isFileExcluded(wsFile, excludePatterns)
			if (!excluded) {
				const { file, data } = getOrCreateFile(controller, wsFile)
				if(file) {
					await data.updateFromDisk(controller, file)
				}
			}
		}
	}
}

function startWatchingWorkspace(controller: vscode.TestController, fileChangedEmitter: vscode.EventEmitter<vscode.Uri> ) {

	return getWorkspaceTestPatterns().map(({ workspaceFolder, includePatterns, excludePatterns }) => {

		const watchers = []

		for (const includePattern of includePatterns) {
			const watcher = vscode.workspace.createFileSystemWatcher(includePattern)

			watcher.onDidCreate(async uri => {
				if (await isFileExcluded(uri, excludePatterns))  {
					return
				}
				getOrCreateFile(controller, uri)
				fileChangedEmitter.fire(uri)
			})

			watcher.onDidChange(async uri => {
				if (await isFileExcluded(uri,excludePatterns)) {
					return
				}

				const { file, data } = getOrCreateFile(controller, uri)
				if (data?.didResolve) {
					await data.updateFromDisk(controller, file)
				}
				fileChangedEmitter.fire(uri)
			})

			watcher.onDidDelete(uri => controller.items.delete(uri.toString()))
			watchers.push(watcher)
		}

		findInitialFiles(controller, includePatterns, excludePatterns)
		return watchers
	}).flat()
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

async function isFileExcluded (uri: vscode.Uri, excludePatterns: vscode.RelativePattern[]) {
	if (!excludePatterns || excludePatterns.length == 0) {
		return false
	}

	const relativePath = vscode.workspace.asRelativePath(uri.fsPath)

	for (const excludePattern of excludePatterns) {
		const files = await vscode.workspace.findFiles(relativePath, excludePattern, 1)
		if (files.length == 0) {
			logToChannel("file excluded: " + relativePath + ", excludePattern: " + excludePattern.pattern)
			return true
		}
	}
	return false
}

////////// DEBUG FUNCTIONS //////////

function printDataType(data: any) {
	if(data instanceof ABLTestSuite)
		logToChannel(" - ABLTestSuite")
	// else if(data instanceof ABLTestClassNamespace)
	// 	logToChannel(" - ABLTestClassNamespace")
	else if(data instanceof ABLTestClass)
		logToChannel(" - ABLTestClass")
	else if(data instanceof ABLTestMethod)
		logToChannel(" - ABLTestMethod")
	else if(data instanceof ABLTestProgram)
		logToChannel(" - ABLTestProgram")
	else if(data instanceof ABLTestProcedure)
		logToChannel(" - ABLTestProcedure")
	else
		logToChannel(" - unexpected instanceof type")
}
