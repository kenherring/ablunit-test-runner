import * as vscode from 'vscode';
import { getContentFromFilesystem, ABLUnitTestData, ABLTestSuiteClass, ABLTestClassNamespace, ABLTestClass, ABLTestProgram, ABLTestMethod, ABLTestProcedure, ABLAssert, testData, TestFile } from './testTree';

export async function activate(context: vscode.ExtensionContext) {
	const ctrl = vscode.tests.createTestController('ablunitTestController', 'ABLUnit Test');
	context.subscriptions.push(ctrl);

	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
	const runHandler = (request: vscode.TestRunRequest2, cancellation: vscode.CancellationToken) => {
		if (!request.continuous) {
			return startTestRun(request);
		}

		const l = fileChangedEmitter.event(uri => startTestRun(
			new vscode.TestRunRequest2(
				[getOrCreateFile(ctrl, uri).file],
				undefined,
				request.profile,
				true
			),
		));
		cancellation.onCancellationRequested(() => l.dispose());
	};

	const startTestRun = (request: vscode.TestRunRequest) => {
		const queue: { test: vscode.TestItem; data: TestFile | ABLTestClass | ABLTestMethod | ABLTestProgram | ABLTestProcedure }[] = [];
		// const queue: { test: vscode.TestItem; data: TestFile | ABLTestSuiteClass | ABLTestClass | ABLTestMethod | ABLTestProgram | ABLTestProcedure }[] = [];
		const run = ctrl.createTestRun(request);
		// map of file uris to statements on each line:
		const coveredLines = new Map</* file uri */ string, (vscode.StatementCoverage | undefined)[]>();

		const discoverTests = async (tests: Iterable<vscode.TestItem>) => {
			for (const test of tests) {
				if (request.exclude?.includes(test)) {
					continue;
				}

				const data = testData.get(test);

				if(data instanceof TestFile)
					console.log(" - TestFile")
				if(data instanceof ABLTestSuiteClass)
					console.log(" - ABLTestSuite")
				if(data instanceof ABLTestClassNamespace)
					console.log(" - ABLTestClassNamespace")
				if(data instanceof ABLTestClass)
					console.log(" - ABLTestClass")
				if(data instanceof ABLTestMethod)
					console.log(" - ABLTestMethod")
				if(data instanceof ABLTestProgram)
					console.log(" - ABLTestProgram")
				if(data instanceof ABLTestProcedure)
					console.log(" - ABLTestProcedure")

				if (data instanceof TestFile || data instanceof ABLTestClass || data instanceof ABLTestMethod) {
					run.enqueued(test);
					queue.push({ test, data });
				} else {
					if (data instanceof TestFile && !data.didResolve) {
						await data.updateFromDisk(ctrl, test);
					}

					await discoverTests(gatherTestItems(test.children));
				}

				if (test.uri && !coveredLines.has(test.uri.toString())) {
					try {
						const lines = (await getContentFromFilesystem(test.uri)).split('\n');
						coveredLines.set(
							test.uri.toString(),
							lines.map((lineText, lineNo) =>
								lineText.trim().length ? new vscode.StatementCoverage(0, new vscode.Position(lineNo, 0)) : undefined
							)
						);
					} catch {
						// ignored
					}
				}
			}
		};

		const runTestQueue = async () => {
			for (const { test, data } of queue) {
				
				run.appendOutput(`Running ${test.id}\r\n`);
				if (run.token.isCancellationRequested) {
					run.skipped(test);
				} else {
					run.started(test);
					await data.run(test, run);
				}

				run.appendOutput(`Completed ${test.id}\r\n`);
			}
			run.end();
		};

		run.coverageProvider = {
			provideFileCoverage() {
				const coverage: vscode.FileCoverage[] = [];
				for (const [uri, statements] of coveredLines) {
					coverage.push(
						vscode.FileCoverage.fromDetails(
							vscode.Uri.parse(uri),
							statements.filter((s): s is vscode.StatementCoverage => !!s)
						)
					);
				}

				return coverage;
			},
		};

		discoverTests(request.include ?? gatherTestItems(ctrl.items)).then(runTestQueue);
	};

	ctrl.refreshHandler = async () => {
		await Promise.all(getWorkspaceTestPatterns().map(({ pattern }) => findInitialFiles(ctrl, pattern)));
	};

	ctrl.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true, new vscode.TestTag("runnable"), false);

	ctrl.resolveHandler = async item => {
		if (!item) {
			context.subscriptions.push(...startWatchingWorkspace(ctrl, fileChangedEmitter));
			return;
		}
		const data = testData.get(item);
		if (data instanceof TestFile) {
			await data.updateFromDisk(ctrl, item);
		}
	};

	function updateNodeForDocument(e: vscode.TextDocument) {
		if (e.uri.scheme !== 'file') {
			return;
		}

		if (!e.uri.path.endsWith('.cls') && !e.uri.path.endsWith('.p')) {
			return;
		}
		const { file, data } = getOrCreateFile(ctrl, e.uri);
		data.updateFromContents(ctrl, e.getText(), file);
		console.log("data.updateFromContents " + file.children.size) //zero
	}

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(updateNodeForDocument),
		vscode.workspace.onDidChangeTextDocument(e => updateNodeForDocument(e.document)),
	);
}

function getOrCreateFile(controller: vscode.TestController, uri: vscode.Uri) {
	const existing = controller.items.get(uri.toString());
	if (existing) {
		return { file: existing, data: testData.get(existing) as TestFile };
	}

	const file = controller.createTestItem(uri.toString(), vscode.workspace.asRelativePath(uri.fsPath), uri);
	file.tags = [ new vscode.TestTag("runnable") ]
	controller.items.add(file);
	const data = new TestFile();
	console.log("testData.set " + file.children.size)
	testData.set(file, data);
	file.canResolveChildren = true;
	return { file, data };
}

function gatherTestItems(collection: vscode.TestItemCollection) {
	const items: vscode.TestItem[] = [];
	collection.forEach(item => items.push(item));
	return items;
}

function getWorkspaceTestPatterns() {
	if (!vscode.workspace.workspaceFolders) {
		return [];
	}

	return vscode.workspace.workspaceFolders.map(workspaceFolder => ({
		workspaceFolder,
		pattern: new vscode.RelativePattern(workspaceFolder, '{**/*.cls,**/*.p}')
	}));
}

// async function findFilesForPattern(controller: vscode.TestController, workspaceFolder: vscode.WorkspaceFolder, pattern: vscode.GlobPattern) {
// 	for (const wsFile of await vscode.workspace.findFiles(pattern)) {
// 		if (wsFile.toString().indexOf(".builder") == -1) {
// 			console.log(wsFile)
// 			const { file, data } = getOrCreateFile(controller, wsFile);
// 			await data.updateFromDisk(controller, file);
// 		}
// 	}
// }

async function findInitialFiles(controller: vscode.TestController, pattern: vscode.GlobPattern) {
	console.log(JSON.stringify(pattern))
	const findAllFilesAtStartup = vscode.workspace.getConfiguration('ablunit').get('findAllFilesAtStartup');
	if (findAllFilesAtStartup) {
		for (const wsFile of await vscode.workspace.findFiles(pattern)) {
			if (wsFile.toString().indexOf(".builder") == -1) {
				const { file, data } = getOrCreateFile(controller, wsFile);
				await data.updateFromDisk(controller, file);
			}
		}
	}

	// console.log("findAllFilesAtStartup=" + findAllFilesAtStartup)
	// if (findAllFilesAtStartup) {
	// 	if (vscode.workspace.workspaceFolders) {
	// 		vscode.workspace.workspaceFolders.map(async workspaceFolder => {
	// 			await findFilesForPattern(controller, workspaceFolder, pattern)
	// 		})
	// 	}
	// }
}

function startWatchingWorkspace(controller: vscode.TestController, fileChangedEmitter: vscode.EventEmitter<vscode.Uri> ) {
	return getWorkspaceTestPatterns().map(({ workspaceFolder, pattern }) => {
		const watcher = vscode.workspace.createFileSystemWatcher(pattern);

		watcher.onDidCreate(uri => {
			getOrCreateFile(controller, uri);
			fileChangedEmitter.fire(uri);
		});
		watcher.onDidChange(async uri => {
			const { file, data } = getOrCreateFile(controller, uri);
			if (uri.toString().indexOf(".builder") == -1) {
				if (data.didResolve) {
					await data.updateFromDisk(controller, file);
				}
			}
			fileChangedEmitter.fire(uri);
		});
		watcher.onDidDelete(uri => controller.items.delete(uri.toString()));

		findInitialFiles(controller, pattern);

		return watcher;
	});
}
