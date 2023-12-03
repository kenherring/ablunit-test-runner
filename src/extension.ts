import * as vscode from 'vscode'
import { ABLResults } from './ABLResults'
import { ABLTestSuite, ABLTestClass, ABLTestProgram, ABLTestMethod, ABLTestProcedure, testData, resultData, ABLTestFile, ABLUnitDir, ABLTestCase, ABLRunnable } from './testTree'
import { GlobSync } from 'glob'
import { logToChannel } from './ABLUnitCommon'
import { readFileSync } from 'fs'

const backgroundExecutable = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255,0,0,0.1)',
})
const backgroundExecuted = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(0,255,0,0.1)',
})

let recentResults: ABLResults[] | undefined
let contextStorageUri: vscode.Uri | undefined = undefined

export async function getStorageUri (workspaceFolder?: vscode.WorkspaceFolder) {
	if (!workspaceFolder) {
		return contextStorageUri
	}

	if (!contextStorageUri) {
		throw new Error("contextStorageUri is undefined")
	}
	const dirs = workspaceFolder.uri.path.split('/')
	const ret = vscode.Uri.joinPath(contextStorageUri,dirs[dirs.length - 1])
	await createDir(ret)
	console.log('storageUri= ' + ret.fsPath)
	return ret
}

export async function activate(context: vscode.ExtensionContext) {

	logToChannel("ACTIVATE!")

	const debugEnabled = vscode.workspace.getConfiguration('ablunit').get('debugEnabled', false)
	const ctrl = vscode.tests.createTestController('ablunitTestController', 'ABLUnit Test')
	logToChannel("context.storageUri= " + context.storageUri?.fsPath)
	contextStorageUri = context.storageUri ?? vscode.Uri.parse("file://" + process.env.TEMP) //should always be defined as context.storageUri
	logToChannel("contextStorageUri=" + contextStorageUri.fsPath)
	await createDir(contextStorageUri)
	logToChannel("created2")

	context.subscriptions.push(ctrl)
	context.subscriptions.push(
		vscode.commands.registerCommand('_ablunit.openCallStackItem', openCallStackItem),
		vscode.window.onDidChangeActiveTextEditor(e => decorate(e!) ),
		vscode.workspace.onDidChangeConfiguration(e => updateConfiguration(e) ),
		vscode.workspace.onDidOpenTextDocument(updateNodeForDocument),
		vscode.workspace.onDidChangeTextDocument(e => updateNodeForDocument(e.document)),
	)

	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>()

	const runHandler = (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) => {
		console.log("runHandler")
		if (!request.continuous) {
			console.log("startTestRun - not continuous")
			return startTestRun(request)
		}

		const l = fileChangedEmitter.event(uri => {
			console.log("startTestRun - file=" + uri.fsPath)
			const file = getOrCreateFile(ctrl, uri).file
			if(file) {
				console.log("startTestRun")
				startTestRun(
					new vscode.TestRunRequest(
						[file],
						undefined,
						request.profile,
						true
					)
				)
			} else {
				console.log("startTestRun - file not found: " + uri.fsPath)
			}
		})
		cancellation.onCancellationRequested(() => l.dispose())
	}

	const startTestRun = (request: vscode.TestRunRequest) => {
		console.log("startTestRun")
		showNotification("running ablunit tests")

		const queue: { test: vscode.TestItem; data: ABLRunnable }[] = []
		console.log("createTestRun")
		const run = ctrl.createTestRun(request)

		console.log('discoverTests')
		const discoverTests = async (tests: Iterable<vscode.TestItem>) => {
			for (const test of tests) {
				if (request.exclude?.includes(test)) {
					continue
				}

				const data = testData.get(test)
				if (debugEnabled) {
					printDataType(data)
				}

				if (data instanceof ABLTestSuite ||
					data instanceof ABLTestClass ||
					data instanceof ABLTestProgram ||
					data instanceof ABLTestMethod ||
					data instanceof ABLTestProcedure) {
					run.enqueued(test)
					queue.push({ test, data })
				} else {
					await discoverTests(gatherTestItems(test.children))
				}
			}
		}

		const runTestQueue = async (res: ABLResults[]) => {
			console.log("runTestQueue")
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

			logToChannel('starting ablunit run')
			run.appendOutput('starting ablunit run\r\n')

			let ret = false
			for (const r of res) {
				r.setTestData(testData) // TODO - should this be broken out?
				logToChannel("starting ablunit tests for folder: " + r.workspaceFolder.uri.fsPath)
				run.appendOutput("starting ablunit tests for folder: " + r.workspaceFolder.uri.fsPath + "\r\n")
				ret = await r.run(run).then(() => {
					return true
				}, (err) => {
					logToChannel("ablunit run failed with exception: " + err,'error')
					return false
				})
				if (!ret) {
					break
				}

				if (r.ablResults) {
					const p = r.ablResults.resultsJson[0]
					const totals = "Totals - " + p.tests + " tests, " + p.passed + " passed, " + p.errors + " errors, " + p.failures + " failures"
					logToChannel(totals)
					run.appendOutput(totals + "\r\n")
				}

				for (const { test } of queue) {
					if (run.token.isCancellationRequested) {
						run.skipped(test)
					} else {
						await r.assignTestResults(test, run)
					}
				}
			}

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

			if (run.token.isCancellationRequested) {
				for (const { test } of queue) {
					run.skipped(test)
				}
			}

			run.end()
			recentResults = resultData.get(run)

			if (vscode.window.activeTextEditor)
				decorate(vscode.window.activeTextEditor)

			showNotification("ablunit tests complete")
		}

		const createABLResults = async () => {
			const res: ABLResults[] = []
			const proms: Promise<void>[] = []

			for(const itemData of queue) {
				const wf = vscode.workspace.getWorkspaceFolder(itemData.test.uri!)
				if (!wf) {
					console.error("Skipping test run for test item with no workspace folder: " + itemData.test.uri!.fsPath)
					continue
				}
				let r = res.find(r => r.workspaceFolder === wf)
				if (!r) {
					r = new ABLResults(wf, await getStorageUri(wf) ?? wf.uri, contextStorageUri!)
					await r.start()
					res.push(r)
				}
				proms.push(r.addTest(itemData.test))
			}
			await Promise.all(proms)
			resultData.set(run, res)
			return res
		}

		discoverTests(request.include ?? gatherTestItems(ctrl.items)).then(async () => {
			const res = await createABLResults()
			runTestQueue(res)
		})
	}

	ctrl.refreshHandler = async () => {
		await Promise.all(getWorkspaceTestPatterns().map(({ includePatterns, excludePatterns }) => findInitialFiles(ctrl, includePatterns, excludePatterns, true)))
	}

	ctrl.resolveHandler = async item => {
		if (!item) {
			context.subscriptions.push(...startWatchingWorkspace(ctrl, fileChangedEmitter))
			return
		}
		const data = testData.get(item)
		if (data instanceof ABLTestSuite || data instanceof ABLTestClass || data instanceof ABLTestProgram) {
			console.log("updateFromDisk-1.1")
			await data.updateFromDisk(ctrl, item)
			console.log("updateFromDisk-1.2")
		}
		console.log("resolveHandler-complete")
	}

	async function updateNodeForDocument(e: vscode.TextDocument) {
		const openEditors = vscode.window.visibleTextEditors.filter(editor => editor.document.uri === e.uri)
		openEditors.forEach(editor => { decorate(editor) })

		if (e.uri.scheme !== 'file') { return }
		if (!e.uri.path.endsWith('.cls') && !e.uri.path.endsWith('.p')) { return }

		if(isFileExcluded(e.uri,getExcludePatterns())) {
			return
		}

		const { file, data } = getOrCreateFile(ctrl, e.uri)
		if (file) {
			console.log("updateFromContents-1")
			data.updateFromContents(ctrl, e.getText(), file)
			console.log("updateFromContents-2")
		}
	}

	async function updateConfiguration(e: vscode.ConfigurationChangeEvent) {
		// resetAblunitConfig()
		// TODO!!!

		if (e.affectsConfiguration('ablunit')) {
			// for(const wf of vscode.workspace.workspaceFolders!) {
			// 	const res = resultData.get(wf.uri)
			// 	if (res) {
			// 		for(const r of res) {
			// 			r.resetAblunitConfig()
			// 		}
			// 	}
			// }

			await removeExcludedFiles(ctrl, getExcludePatterns())
		}
	}

	ctrl.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, false, new vscode.TestTag("runnable"), false)
	// ctrl.createRunProfile('Debug Tests', vscode.TestRunProfileKind.Debug, runHandler, false, new vscode.TestTag("runnable"), false)
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

	const data = createTopNode(uri)
	if(!data) {
		return { file: undefined, data: undefined }
	}

	const file = controller.createTestItem(uri.toString(), vscode.workspace.asRelativePath(uri.fsPath), uri)
	file.tags = [ new vscode.TestTag("runnable") ]

	controller.items.add(file)
	testData.set(file, data)
	file.canResolveChildren = true
	file.description = "xyz"
	return { file, data }
}

function createTopNode(file: vscode.Uri) {
	const fileAttrs = getTestFileAttrs(file)
	if (fileAttrs === "none") {
		return undefined
	}

	if (fileAttrs === "suite") {
		return new ABLTestSuite()
	}
	if (file.fsPath.endsWith(".cls")) {
		return new ABLTestClass()
	}
	return new ABLTestProgram()
}

function getTestFileAttrs(file: vscode.Uri | undefined) {
	if (!file) {
		return "none"
	}
	const suiteRegex = /@testsuite/i
	const contents = readFileSync(file.fsPath).toString()
	if (!contents) {
		return "none"
	}
	if (contents.length < 1) {
		return "none"
	}

	if (suiteRegex.test(contents)) {
		return "suite"
	}
	return "other"
}

function gatherTestItems(collection: vscode.TestItemCollection) {
	const items: vscode.TestItem[] = []
	collection.forEach(item => items.push(item))
	return items
}

function getABLTestFiles(collection: vscode.TestItemCollection) {
	let items: vscode.TestItem[] = []
	collection.forEach(item => {
		if(item instanceof ABLTestFile) {
			items.push(item)
		} else if(item instanceof ABLUnitDir) {
			items = items.concat(getABLTestFiles(item.children))
		}
	})
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
	const items = gatherTestItems(controller.items)

	for (const element of items) {
		const item = element
		const data = testData.get(item)
		if (item.id === "ABLTestSuiteGroup" || data instanceof ABLUnitDir) {
			await removeExcludedChildren(item, excludePatterns)
		}
		if (item.uri && (data instanceof ABLTestSuite || data instanceof ABLTestClass || data instanceof ABLTestProgram)) {
			const excluded = isFileExcluded(item.uri, excludePatterns)
			if (item.uri && excluded) {
				testData.delete(item)
				controller.items.delete(item.id)
			}
		}
		if (data instanceof ABLUnitDir && item.children.size == 0) {
			testData.delete(item)
			controller.items.delete(item.id)
		}
	}
}

async function removeExcludedChildren(parent: vscode.TestItem, excludePatterns: vscode.RelativePattern[]) {
	if (!parent.children) {
		return
	}

	for(const [,item] of parent.children) {
		const data = testData.get(item)
		if (data instanceof ABLTestFile) {
			const excluded = isFileExcluded(item.uri!, excludePatterns)
			if (item.uri && excluded) {
				parent.children.delete(item.id)
				testData.delete(item)
			}
		} else if (data?.isFile) {
			await removeExcludedChildren(item, excludePatterns)
			if (item.children.size == 0) {
				parent.children.delete(item.id)
				testData.delete(item)
			}
		}
	}
}

async function findInitialFiles(controller: vscode.TestController,
								includePatterns: vscode.RelativePattern[],
								excludePatterns: vscode.RelativePattern[],
								removeExcluded: boolean = false) {
	const findAllFilesAtStartup = vscode.workspace.getConfiguration('ablunit').get('findAllFilesAtStartup')

	if (!findAllFilesAtStartup) {
		if (removeExcluded) {
			await removeExcludedFiles(controller, excludePatterns)
		}
		return
	}

	for (const includePattern of includePatterns) {
		for (const wsFile of await vscode.workspace.findFiles(includePattern)) {
			if (isFileExcluded(wsFile, excludePatterns)) {
				continue
			}
			const { file, data } = getOrCreateFile(controller, wsFile)
			if(file) {
				console.log("updateFromDisk-2.1")
				await data.updateFromDisk(controller, file)
				console.log("updateFromDisk-2.2")
			}
		}
	}

	if (removeExcluded) {
		await removeExcludedFiles(controller, excludePatterns)
	}
	console.log("findInitialFiles-complete")
}

function startWatchingWorkspace(controller: vscode.TestController, fileChangedEmitter: vscode.EventEmitter<vscode.Uri> ) {

	return getWorkspaceTestPatterns().map(({ workspaceFolder, includePatterns, excludePatterns }) => {

		const watchers = []

		for (const includePattern of includePatterns) {
			const watcher = vscode.workspace.createFileSystemWatcher(includePattern)

			watcher.onDidCreate(async uri => {
				if (isFileExcluded(uri, excludePatterns))  {
					return
				}
				getOrCreateFile(controller, uri)
				fileChangedEmitter.fire(uri)
			})

			watcher.onDidChange(async uri => {
				if (isFileExcluded(uri,excludePatterns)) {
					return
				}

				const { file, data } = getOrCreateFile(controller, uri)
				if (data?.didResolve) {
					console.log("updateFromDisk-3.1")
					await data.updateFromDisk(controller, file)
					console.log("updateFromDisk-3.2")
				}
				fileChangedEmitter.fire(uri)
			})

			watcher.onDidDelete(uri => controller.items.delete(uri.toString()))
			watchers.push(watcher)
		}

		findInitialFiles(controller, includePatterns, excludePatterns)
		console.log("startWatchingWorkspace-complete")
		return watchers
	}).flat()

}

function decorate(editor: vscode.TextEditor) {
	const executedArray: vscode.DecorationOptions[] = []
	const executableArray: vscode.DecorationOptions[] = []

	if(!recentResults || recentResults.length == 0) { return }

	const wf = vscode.workspace.getWorkspaceFolder(editor.document.uri)
	const idx = recentResults.findIndex(r => r.workspaceFolder === wf)
	if (idx < 0) { return }

	const tc = recentResults[idx].testCoverage.get(editor.document.uri.fsPath)
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
	console.log("[showNotification] " + message)
	if (vscode.workspace.getConfiguration('ablunit').get('notificationsEnabled', true)) {
		vscode.window.showInformationMessage(message)
	}
}

function isFileExcluded(uri: vscode.Uri, excludePatterns: vscode.RelativePattern[]) {
	const patterns = excludePatterns.map(pattern => pattern.pattern)
	const relativePath = vscode.workspace.asRelativePath(uri.fsPath, false)
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
	if (!workspaceFolder) {
		return true
	}
	const g = new GlobSync(relativePath, { cwd: workspaceFolder.uri.fsPath, ignore: patterns })
	return g.found.length == 0
}

////////// DEBUG FUNCTIONS //////////

function printDataType(data: any) {
	if (data instanceof ABLUnitDir)
		logToChannel(" - ABLUnitDir")
	if (data instanceof ABLTestFile)
		logToChannel(" - ABLTestFile")
	if (data instanceof ABLTestCase)
		logToChannel(" - ABLTestCase")
	if (data instanceof ABLTestSuite)
		logToChannel(" - ABLTestSuite")
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

function createDir(uri: vscode.Uri) {
	if(!uri) {
		return
	}
	return vscode.workspace.fs.stat(uri).then((stat) => {
		console.log("stat:" + stat.type)
		if (!stat) {
			logToChannel("create dir for extension storage: " + uri.fsPath)
			return vscode.workspace.fs.createDirectory(uri)
		} else {
			console.log("extension storage directory already exists: " + uri.fsPath)
		}
	}, (err) => {
		logToChannel("create dir for extension storage: " + uri.fsPath)
		return vscode.workspace.fs.createDirectory(uri)
	})
}
