import * as vscode from 'vscode';
import { getContentFromFilesystem, ABLUnitTestData, ABLTestSuiteClass, ABLTestClass, ABLTestProgram, ABLTestMethod, ABLTestProcedure, ABLAssert, testData, TestFile } from './testTree';

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
		console.log("startTestRun")
		const queue: { test: vscode.TestItem; data: TestFile | ABLTestSuiteClass | ABLTestClass | ABLTestMethod | ABLTestProgram | ABLTestProcedure }[] = [];
		const run = ctrl.createTestRun(request);
		// map of file uris to statements on each line:
		const coveredLines = new Map</* file uri */ string, (vscode.StatementCoverage | undefined)[]>();

		const discoverTests = async (tests: Iterable<vscode.TestItem>) => {
			console.log("discoverTests")
			for (const test of tests) {
				console.log("discoverTests2")
				if (request.exclude?.includes(test)) {
					continue;
				}

				const data = testData.get(test);
				console.log("data instanceof?")

				if(data instanceof TestFile)
					console.log(" - TestFile")
				if(data instanceof ABLTestSuiteClass)
					console.log(" - ABLTestSuite")
				if(data instanceof ABLTestClass)
					console.log(" - ABLTestClass")
				if(data instanceof ABLTestMethod)
					console.log(" - ABLTestMethod")
				if(data instanceof ABLTestProgram)
					console.log(" - ABLTestProgram")
				if(data instanceof ABLTestProcedure)
					console.log(" - ABLTestProcedure")

				if (data instanceof TestFile || data instanceof ABLTestClass || data instanceof ABLTestMethod) {
					console.log("data instanceof= true!")
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
			console.log("runTestQueue")
			console.log("runTestQueue2: " + queue)
			for (const { test, data } of queue) {
				
				console.log("runTestQueue2")
				run.appendOutput(`Running ${test.id}\r\n`);
				if (run.token.isCancellationRequested) {
					run.skipped(test);
				} else {
					run.started(test);
					console.log("data.run start")
					await data.run(test, run);
					console.log("data.run complete")
				}
				console.log("coverage?")

				// const lineNo = test.range!.start.line;
				// const fileCoverage = coveredLines.get(test.uri!.toString());
				// if (fileCoverage) {
				// 	fileCoverage[lineNo]!.executionCount++;
				// }
				console.log("run.appendOutput()")

				run.appendOutput(`Completed ${test.id}\r\n`);
				console.log("appended")
			}
			console.log("run.end()");
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
		var deleteme: vscode.TestItem[] = []
	};

	ctrl.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true, new vscode.TestTag("runnable"), false);

	ctrl.resolveHandler = async item => {
		if (!item) {
			await discoverAllFilesInWorkspace();
			context.subscriptions.push(...startWatchingWorkspace(ctrl, fileChangedEmitter));
			return;
		}
		const data = testData.get(item);
		if (data instanceof TestFile) {
			await data.updateFromDisk(ctrl, item);
		}
	};

	async function discoverAllFilesInWorkspace() {
		if (!vscode.workspace.workspaceFolders) {
		  return []; // handle the case of no open folders
		}
		console.log("discoverAllFilesInWorkspace")
	  
		return Promise.all(
		  vscode.workspace.workspaceFolders.map(async workspaceFolder => {
			const pattern = new vscode.RelativePattern(workspaceFolder, '**/*.(cls|p)');
			const watcher = vscode.workspace.createFileSystemWatcher(pattern);
	  
			// When files are created, make sure there's a corresponding "file" node in the tree
			watcher.onDidCreate(uri => getOrCreateFile(ctrl,uri));
			// When files change, re-parse them. Note that you could optimize this so
			// that you only re-parse children that have been resolved in the past.
			watcher.onDidChange(uri => getOrCreateFile(ctrl, uri));
			// And, finally, delete TestItems for removed files. This is simple, since
			// we use the URI as the TestItem's ID.
			watcher.onDidDelete(uri => ctrl.items.delete(uri.toString()));
	  
			for (const file of await vscode.workspace.findFiles(pattern)) {
				console.log(file)
				getOrCreateFile(ctrl,file);
			}
	  
			return watcher;
		  })
		);
	  }

	function updateNodeForDocument(e: vscode.TextDocument) {
		if (e.uri.scheme !== 'file') {
			return;
		}

		if (!e.uri.path.endsWith('.cls') && !e.uri.path.endsWith('.p')) {
			return;
		}
		// console.log ("updateNodeForDocument");
		// const content = "getContentFromFileSystem"
		// if (content.toLowerCase().indexOf("@Test.") == -1) {
		// 	console.log(2)
		// 	return;
		// }
		// console.log(3)
		// console.log ("updateNodeForDocument");
		const { file, data } = getOrCreateFile(ctrl, e.uri);
		data.updateFromContents(ctrl, e.getText(), file);
	}

	for (const document of vscode.workspace.textDocuments) {
		updateNodeForDocument(document);
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

	// const content = getContentFromFilesystem(uri!).toString();
	// console.log("content: " + content)
	// if(content.toLowerCase().indexOf("@test") != -1) {
	// 	return
	// }

	const file = controller.createTestItem(uri.toString(), uri.path.split('/').pop()!, uri);
	file.tags = [ new vscode.TestTag("runnable") ]
	controller.items.add(file);

	const data = new TestFile();
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
		pattern: new vscode.RelativePattern(workspaceFolder, '**/*.(cls|p)')
	}));
}

async function findInitialFiles(controller: vscode.TestController, pattern: vscode.GlobPattern) {
	for (const file of await vscode.workspace.findFiles(pattern)) {
		getOrCreateFile(controller, file);
	}
	
	controller.items.forEach(item => {
		if (item.children.size == 0) {
			console.log("DELETE")
			controller.items.delete(item.id)
		}
	});
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
			if (data.didResolve) {
				await data.updateFromDisk(controller, file);
			}
			fileChangedEmitter.fire(uri);
		});
		watcher.onDidDelete(uri => controller.items.delete(uri.toString()));

		findInitialFiles(controller, pattern);

		return watcher;
	});
}
