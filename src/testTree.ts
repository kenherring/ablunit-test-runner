import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { parseABLUnit } from './parser';
import { parseABLCallStack } from './ablHelper';
import { ABLResultsParser, TestCase } from './parse/ablResultsParser';
import * as cp from "child_process";

const textDecoder = new TextDecoder('utf-8');

export type ABLUnitTestData = ABLTestSuiteClass | ABLTestProgramDirectory | ABLTestClassNamespace | ABLTestClass | ABLTestProgram | ABLTestMethod | ABLTestProcedure | ABLAssert

export const testData = new WeakMap<vscode.TestItem, ABLUnitTestData>();

let generationCounter = 0;

export const getContentFromFilesystem = async (uri: vscode.Uri) => {
	try {
		const rawContent = await vscode.workspace.fs.readFile(uri);
		return textDecoder.decode(rawContent);
	} catch (e) {
		console.warn(`Error providing tests for ${uri.fsPath}`, e);
		return '';
	}
};

class TestTypeObj {
	public didResolve: boolean = false
	public name: string = ""
	public label: string = ""
	protected storageUri: vscode.Uri | undefined
	protected extensionUri: vscode.Uri | undefined
	
	getLabel() {
		return this.label
	}

	public setStorageUri(extensionUri: vscode.Uri, storageUri: vscode.Uri | undefined) {
		this.extensionUri = extensionUri
		this.storageUri = storageUri
	}

	getExtensionUri() {
		if (!this.extensionUri) {
			// should be impossible to hit this
			throw ("extensionUri not set")
		}
		return this.extensionUri
	}

	protected workspaceDir = () => {
		const workspaceDir = vscode.workspace.workspaceFolders?.map(item => item.uri)[0]
		if (!workspaceDir) {
			throw ("no workspace directory opened")
		}
		return vscode.Uri.file(workspaceDir.fsPath)
	}
}

class TestFile extends TestTypeObj{
	public testFileType = "TestFile";
	protected replaceWith: vscode.TestItem | undefined = undefined

	public async updateFromDisk(controller: vscode.TestController, item: vscode.TestItem) {
		try {
			const content = await getContentFromFilesystem(item.uri!);
			item.error = undefined;
			this.updateFromContents(controller, content, item);
			if (item.children.size == 0) {
				controller.items.delete(item.id)
				return
			}

			if(this.replaceWith != undefined) {
				const currItem = controller.items.get(this.replaceWith.id)

				if (currItem) {
					this.addItemsToController(currItem, this.replaceWith)
				} else {
					console.log("add item " + this.replaceWith.id + " to controller")
					controller.items.add(this.replaceWith)
					// controller.items.delete(item.id)
				}
				console.log("delete " + item.id)
				controller.items.delete(item.id)
			} else {
				//this is definitely valid for classes - not sure about other types
				//if a class has no @test annotations it won't have any children to display
				const hasCurrent = controller.items.get(item.id)
				if(hasCurrent) {
					controller.items.delete(item.id)
				}
			}
			controller.items.delete(item.id)
		} catch (e) {
			item.error = (e as Error).stack;
		}
	}

	addItemsToController(item: vscode.TestItem, addItem: vscode.TestItem) {

		addItem.children.forEach(addChild => {
			const currChild = item.children.get(addChild.id)
			if (currChild) {
				this.addItemsToController(currChild, addChild)
			} else {
				item.children.add(addChild)
			}
		})
	}

	ascend(depth: number, ancestors: [{ item: vscode.TestItem, children: vscode.TestItem[] }]) {
		// for(let idx=0; idx<ancestors.length; idx++) {
		// 	console.log("1: ancestor-label[" + idx + "]=" + ancestors[idx].item.label + " " + ancestors[idx].item.children.size + " " + JSON.stringify(ancestors[idx].item.tags) + " parent=" +  ancestors[idx].item.parent?.label)
		// }
		while (ancestors.length > depth) {
			const finished = ancestors.pop()!;
			finished.item.children.replace(finished.children);
			// console.log("2: ancestor-label-" + depth + "=" + finished.item.label + " " + finished.children + " " + JSON.stringify(finished.item.tags) + " parent=" +  finished.item.parent?.label)
			this.replaceWith = finished.item
			// this.replaceWith.children.replace(finished.children)
			// console.log("REPLACED_WITH=" + this.replaceWith?.id + " " + this.replaceWith?.label + " " + this.replaceWith?.children.size + " " + this.replaceWith.uri)
		}
	}

	public updateFromContents(controller: vscode.TestController, content: string, item: vscode.TestItem) {
		console.error("updateFromContents TestFile - skipping")
	}

	 getProgressIni() {
		//TODO - only for windows
		if (!this.workspaceDir) {
			throw ("no workspace directory opened")
		}
		console.log("getProgressIni workspaceDir=" + this.workspaceDir)

		//first, check if the progressIni config is set for the workspace
		const configIni = vscode.workspace.getConfiguration('ablunit').get('progressIni', '')
		if (configIni != '') {
			const uri1 = vscode.Uri.joinPath(this.workspaceDir(), configIni)
			console.log("uri1=" + uri1)
			if(uri1){
				return uri1
			}
		}

		//second, check if there is a progress ini in the root of the repo
		console.log("workspaceDir=" + this.workspaceDir)
		if(this.workspaceDir) {
			const uri2 = vscode.Uri.joinPath(this.workspaceDir(), 'progress.ini')
			console.log("uri2=" + uri2)
			if (uri2) {
				return uri2
			}
		}

		//third, check if the workspace has a temp directory configured
		const uri3 = vscode.Uri.parse(vscode.workspace.getConfiguration('ablunit').get('tempDir', ''))
		console.log("uri3=" + uri3)
		if (uri3) {
			return uri3
		}

		//fourth, and lastly, use the extension temp directory
		if(this.storageUri) {
			const stat1 = vscode.workspace.fs.stat(this.storageUri)
			console.log("stat1=" + stat1)
			if(!stat1) {
				vscode.workspace.fs.createDirectory(this.storageUri)
			}
			const stat2 = vscode.workspace.fs.stat(this.storageUri)
			console.log("stat2=" + stat2)

			const uri4 = vscode.Uri.joinPath(this.storageUri, 'progress.ini')
			console.log("uri4=" + uri4)
			if(uri4) {
				return uri4
			}
		}
		throw ("cannot find a suitable progress.ini or temp directory")
	}

	createProgressIni (progressIni: vscode.Uri) {
		const iniData = [ "[WinChar Startup]", "PROPATH=." ]
		vscode.workspace.fs.writeFile(progressIni, Uint8Array.from(Buffer.from(iniData.join("\n"))))
	}

	getCommand(itemPath: string): string {
		if(!this.storageUri) {
			throw ("temp directory not set")
		}
		vscode.workspace.fs.createDirectory(this.storageUri)

		const progressIni = this.getProgressIni()
		if (!progressIni) { throw ("cannot find progress.ini or suitable location to write one") }
		const progressIniStat = vscode.workspace.fs.stat(progressIni)
		if(! progressIniStat) {
			console.log("progress.ini does not exist - creating")
			this.createProgressIni(progressIni)
		}

		var cmd = vscode.workspace.getConfiguration('ablunit').get('runTestCommand', '').trim();
		if (! cmd) {
			cmd = '_progres -b -p ABLUnitCore.p -basekey INI -ininame "${progressIni}" -param "${itemPath} CFG=ablunit.json"';
		}
		cmd = cmd.replace("${itemPath}",itemPath).replace("${progressIni}",progressIni.fsPath);
		return cmd
	}

	async runCommand(itemPath: string, options: vscode.TestRun) {
		const cmd: string = this.getCommand(itemPath)

		vscode.window.showInformationMessage("running ablunit tests");
		await vscode.tasks.executeTask(
			new vscode.Task(
				{ type: 'shell' },
				vscode.TaskScope.Global,
				"ablunit run tests",
				"ablunit-test-provider",
				new vscode.ShellExecution(cmd, {
					// eslint-disable-next-line @typescript-eslint/naming-convention
					env: vscode.l10n.uri ? { EXTENSION_BUNDLE_PATH: vscode.l10n.uri?.fsPath } : undefined
				})));
		vscode.window.showInformationMessage("ablunit tests complete");
	}

	async parseResults () {
		if (!this.workspaceDir()) {}
		const resultsUri = vscode.Uri.joinPath(this.workspaceDir(),"/results.xml")
		const ablResults = new ABLResultsParser()
		await ablResults.importResults(resultsUri)
		return ablResults.resultsJson
	}
	
	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		console.error("run via TestFile is not supported")
	}

	setChildResults(item: vscode.TestItem, options: vscode.TestRun, tc: TestCase) {
		switch(tc.status) {
			case "Success":
				options.passed(item, tc.time)
				return
			case "Failure":
				if (tc.failure) {
					options.failed(item, [
						new vscode.TestMessage(tc.failure.message),
						new vscode.TestMessage(tc.failure.callstack)
					], tc.time)
					return
				}
				throw("unexpected failure")
			case "Error":
				if (tc.error) {
					options.failed(item, [
						new vscode.TestMessage(tc.error.message),
						new vscode.TestMessage(tc.error.callstack)
					])
					return
				}
				throw("unexpected error")
			case "Skpped":
				options.skipped(item)
				return
			default:
				options.errored(item, new vscode.TestMessage("unexpected test status: " + tc.status),tc.time)
				return
		}
	}
}

export class ABLTestSuiteClass extends TestTypeObj {

	constructor(
		public generation: number,
		private readonly suiteName: string
	) { super() }

	getLabel() {
		return this.suiteName
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		console.log("ABLTestSuite.run() TODO")
	}
}

export class ABLTestClassNamespace extends TestTypeObj {
	public canResolveChildren: boolean = false

	constructor(
		public generation: number,
		private readonly classpath: string,
		private readonly element: string
	) { super() }

	getLabel() {
		return this.element
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		console.log("ABLTestClassNamespace.run() TODO")
	}
}

export class ABLTestClass extends TestFile {
	public canResolveChildren: boolean = true
	methods: ABLTestMethod[] = []
	
	setClassInfo(classname: string, classlabel: string) {
		this.name = classname
		this.label = classlabel
	}

	addMethod(method: ABLTestMethod) {
		this.methods[this.methods.length] = method
	}

	public updateFromContents(controller: vscode.TestController, content: string, item: vscode.TestItem) {
		var ancestors: [{item: vscode.TestItem, children: vscode.TestItem[] }] = [{ item, children: [] as vscode.TestItem[] }]
		ancestors.pop()
		const thisGeneration = generationCounter++;
		this.didResolve = true;

		parseABLUnit(content, vscode.workspace.asRelativePath(item.uri!.fsPath), {
			
			onTestSuite: (range, suiteName) => {
				// this.testFileType = "ABLTestSuite"
				// const parent = ancestors[ancestors.length - 1]
				// const id = `${item.uri}/${suiteName}`

				// const thead = controller.createTestItem(id, suiteName, item.uri)
				// thead.range = range
				// thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestSuite") ]
				// testData.set(thead, new ABLTestSuiteClass(thisGeneration, suiteName))
				// parent.children.push(thead)
				// ancestors.unshift({ item: thead, children: [] })
			},

			onTestClassNamespace: (range: vscode.Range, classpath: string, element: string, classpathUri: vscode.Uri) => {
				this.testFileType = "ABLTestClassNamespace2"
				const id = `classpath:${classpath}`
				const thead = controller.createTestItem(id, classpath, classpathUri)
				thead.range = range
				if (element == "classpath root") {
					thead.tags = [ new vscode.TestTag("ABLTestClassNamespace") ]
				} else {
					thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClassNamespace") ]
				}
				thead.label = element
				
				if (ancestors.length > 0) {
					var parent = ancestors[ancestors.length - 1]
					parent.children.push(thead)
				}
				testData.set(thead, new ABLTestClassNamespace(thisGeneration, classpath, element));
				ancestors.push({ item: thead, children: [] as vscode.TestItem[]})
			},

			onTestClass: (range: vscode.Range, classpath: string, label: string) => {
				this.testFileType = "ABLTestClass"
				
				const id = `${classpath}`
				const thead = controller.createTestItem(id, classpath, item.uri)
				thead.range = range
				thead.label = label
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClass") ]
				var tData = new ABLTestClass()
				tData.setClassInfo(classpath, label)
				testData.set(thead, tData)
				
				var parent = ancestors[ancestors.length - 1]
				if(parent) {
					parent.children.push(thead)
				}
				ancestors.push({ item: thead, children: [] as vscode.TestItem[] })
			},

			onTestProgramDirectory (range: vscode.Range, programname: string, dir: string) { console.error("should not be here! programname=" + programname + " dir=" + dir) },

			onTestProgram: (range: vscode.Range, relativepath: string, label: string, programUri: vscode.Uri) => { console.error("should not be here! relativepath=" + relativepath) },

			onTestMethod: (range: vscode.Range, classpath: string, methodname: string) => {
				this.testFileType = "ABLTestMethod"
				const id = `${classpath}#${methodname}`
				const thead = controller.createTestItem(id, methodname, item.uri);
				thead.range = range;
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestMethod") ]
				thead.label = methodname
				testData.set(thead, new ABLTestMethod(thisGeneration, classpath, methodname));
				var parent = ancestors[ancestors.length - 1];
				parent.children.push(thead)
				item.children.add(thead)
			},

			onTestProcedure: (range: vscode.Range, programname: string, procedurename: string) => { console.log("should not be here! programname=" + programname + " procedurename=" + procedurename) },
			
			onAssert: (range, assertMethod) => {
				this.testFileType = "ABLAssert"
				const parent = ancestors[ancestors.length - 1];
				const id = `${item.uri}/${assertMethod}`;

				const thead = controller.createTestItem(id, assertMethod, item.uri);
				thead.range = range;
				thead.tags = [ new vscode.TestTag("not runnable"), new vscode.TestTag("ABLAssert") ]
				testData.set(thead, new ABLAssert(thisGeneration, assertMethod));
				parent.children.push(thead);
			}
		});

		this.ascend(0, ancestors); // finish and assign children for all remaining items
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		const start = Date.now();

		let itemPath = vscode.workspace.asRelativePath(item.uri!.fsPath);
		// }
		const workspaceDir = vscode.workspace.workspaceFolders?.map(item => item.uri.fsPath);

		var cmd = vscode.workspace.getConfiguration('ablunit').get('runTestCommand', '').trim();
		if (! cmd) {
			cmd = '_progres -b -p ABLUnitCore.p -basekey INI -ininame progress.ini -param "${itemPath} CFG=ablunit.json"';
		}
		cmd = cmd.replace("${itemPath}",itemPath);

		await new Promise<string>((resolve, reject) => {
			cp.exec(cmd, { cwd: workspaceDir?.toString() }, (err, stdout, stderr) => {
				if (err) {
					// console.log(cmd+' error!');
					// console.log(err);
					options.appendOutput(stderr);
					reject(err);
				}
				options.appendOutput(stdout);
				return resolve(stdout);
			});
		});
		const duration = Date.now() - start;

		const fs = require('fs');
		var parseString = require('xml2js').parseString;

		
		const resultsPath = vscode.workspace.getConfiguration('ablunit').get('resultsPath', '').trim();
		const resultsUri = vscode.Uri.joinPath(this.workspaceDir(),"/results.xml")
		const ablResults = new ABLResultsParser()
		await ablResults.importResults(resultsUri)
		const results = ablResults.resultsJson

		if(!results || !results.name){
			options.errored(item, new vscode.TestMessage("cannot find top node `testsuites` in results.xml"))
			return
		} else if(!results.testsuite) {
			options.errored(item, new vscode.TestMessage("cannot find testsuite in results.xml"))
			return
		} if (results.testsuite.length > 1) {
			options.errored(item, new vscode.TestMessage("invalid results.xml - should only have 1 test suite"))
		} else {
			if (results.testsuite[0].tests > 0) {
				if(results.testsuite[0].errors == 0 && results.testsuite[0].failures == 0) {
					options.passed(item)
				} else if (results.testsuite[0].tests = results.testsuite[0].skipped) {
					options.skipped(item)
				} else if (results.testsuite[0].failures > 0 || results.testsuite[0].errors > 0) {
					options.failed(item, new vscode.TestMessage("one or more tests failed"), results.testsuite[0].time)
				} else {
					options.errored(item, new vscode.TestMessage("unknown error - test results are all zero"), results.testsuite[0].time)
				}
			}

			const testcases = results.testsuite[0].testcases
			if(testcases) {

				item.children.forEach(child => {
					if (testcases?.length) {
						for(let idx=0; idx<testcases.length; idx++) {
							const tc = testcases[idx]
							if (child.label == tc.name) {
								this.setChildResults(child,options,tc)
							}
						}
					}
				})
			}
		}
	}

	setChildResults(item: vscode.TestItem, options: vscode.TestRun, tc: TestCase) {
		switch(tc.status) {
			case "Success":
				options.passed(item, tc.time)
				return
			case "Failure":
				if (tc.failure) {
					options.failed(item, [
						new vscode.TestMessage(tc.failure.message),
						new vscode.TestMessage(tc.failure.callstack)
					], tc.time)
					return
				}
				throw("unexpected failure")
			case "Error":
				if (tc.error) {
					options.failed(item, [
						new vscode.TestMessage(tc.error.message),
						new vscode.TestMessage(tc.error.callstack)
					])
					return
				}
				throw("unexpected error")
			case "Skpped":
				options.skipped(item)
				return
			default:
				options.errored(item, new vscode.TestMessage("unexpected test status: " + tc.status),tc.time)
				return
		}
	}
	
}

export class ABLTestProgramDirectory extends TestTypeObj {
	public canResolveChildren: boolean = false

	constructor(
		public generation: number,
		private readonly relativeDir: string,
		private readonly element: string
	) { super() }

	getLabel() {
		return this.element
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		console.log("ABLTestClassNamespace.run() TODO")
	}
}

export class ABLTestProgram extends TestFile {
	public canResolveChildren: boolean = true
	procedures: ABLTestProcedure[] = []
	
	setProgramInfo(programname: string, programlabel: string) {
		this.name = programname
		this.label = programlabel
	}

	addMethod(method: ABLTestProcedure) {
		this.procedures[this.procedures.length] = method
	}

	public updateFromContents(controller: vscode.TestController, content: string, item: vscode.TestItem) {
		const ancestors: [{item: vscode.TestItem, children: vscode.TestItem[] }] = [{ item, children: [] as vscode.TestItem[] }]
		ancestors.pop()
		const thisGeneration = generationCounter++;
		this.didResolve = true;

		parseABLUnit(content, vscode.workspace.asRelativePath(item.uri!.fsPath), {

			onTestSuite: (range, suiteName) => { console.error("onTestSuite") },

			onTestClassNamespace: (range, classpath, element) => { console.error("onTestClassNamespace") },

			onTestClass: (range: vscode.Range, classname: string, label: string) => { console.error("onTestClassNamespace") },
			
			onTestProgramDirectory (range: vscode.Range, dirpath: string, dir: string, dirUri: vscode.Uri) {
				const id = `pgmpath:${dirpath}`
				const thead = controller.createTestItem(id, dirpath, dirUri)
				thead.range = range
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestProgramDirectory")]
				thead.label = dir

				if (ancestors.length > 0) {
					var parent = ancestors[ancestors.length - 1]
					parent.children.push(thead)
				}

				testData.set(thead, new ABLTestProgramDirectory(thisGeneration, dir, dir))
				ancestors.push({ item: thead, children: [] as vscode.TestItem[]})
			},

			onTestProgram: (range: vscode.Range, relativepath: string, label: string, programUri: vscode.Uri) => {
				this.testFileType = "ABLTestProgram"
				
				const id = `${relativepath}`
				const thead = controller.createTestItem(id, relativepath, item.uri)
				thead.range = range
				thead.label = label
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestProgram")]
				var tData = new ABLTestProgram()
				tData.setProgramInfo(relativepath, label)
				testData.set(thead, tData)

				var parent = ancestors[ancestors.length - 1]
				if (parent) {
					parent.children.push(thead)
				}
				ancestors.push({ item: thead, children: [] as vscode.TestItem[] })
			},

			onTestMethod: (range: vscode.Range, classname: string, methodname: string) => { console.error("onTestMethod") },

			onTestProcedure: (range: vscode.Range, relativePath: string, procedureName: string) => {
				this.testFileType = "ABLTestProcedure"
				
				const id = `${relativePath}#${procedureName}`
				const thead = controller.createTestItem(id, procedureName, item.uri)
				thead.range = range
				thead.label = procedureName
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestProcedure") ]
				testData.set(thead, new ABLTestProcedure(thisGeneration, relativePath, procedureName))
				
				var parent = ancestors[ancestors.length - 1]
				parent.children.push(thead)
			},
			
			onAssert: (range, assertMethod) => {
				this.testFileType = "ABLAssert"
				const parent = ancestors[ancestors.length - 1];
				const id = `${item.uri}/${assertMethod}`;

				const thead = controller.createTestItem(id, assertMethod, item.uri);
				thead.range = range;
				thead.tags = [ new vscode.TestTag("not runnable"), new vscode.TestTag("ABLAssert") ]
				testData.set(thead, new ABLAssert(thisGeneration, assertMethod));
				parent.children.push(thead);
			}
		});

		this.ascend(0, ancestors); // finish and assign children for all remaining items
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		const start = Date.now();
		let itemPath = vscode.workspace.asRelativePath(item.uri!.fsPath);
		const workspaceDir = vscode.workspace.workspaceFolders?.map(item => item.uri.fsPath)[0]; //todo what about if we have multiple workspaces???
		if(!workspaceDir) {
			options.errored(item, new vscode.TestMessage("cannot resolve workspace directory"))
			return
		}
		await this.runCommand(itemPath, options)
		const duration = Date.now() - start;
		const res = await this.parseResults()

		if(!res || !res['testsuite']) {
			options.errored(item, new vscode.TestMessage("malformed results - could not find 'testsuite' node"), duration)
			return
		}

		const s = res.testsuite.find((s: any) => s = item.id)
		if (!s) {
			options.errored(item, new vscode.TestMessage("could not find test suite in results"), duration)
			return
		}
		if (s.tests > 0) {
			if(s.errors == 0 && s.failures == 0) {
				options.passed(item, s.time)
			} else if (s.tests = s.skipped) {
				options.skipped(item)
			} else if (s.failures > 0 || s.errors > 0) {
				options.failed(item, new vscode.TestMessage("one or more tests failed"), s.time)
			} else {
				options.errored(item, new vscode.TestMessage("unknown error - test results are all zero"), s.time)
			}
		}

		if (!s.testcases) {
			options.errored(item, new vscode.TestMessage("malformed results - could not find 'testcases' node"), duration)
			return
		}

		item.children.forEach(child => {
			const tc = s.testcases?.find(t => t.name === child.label)
			if(!tc) {
				options.errored(child, new vscode.TestMessage("could not find result for test case"))
				return
			}
			this.setChildResults(child, options, tc)
		})
		return
	}
}

export class ABLTestMethod extends TestTypeObj { // child of TestClass

	constructor(public generation: number,
				private readonly classname: string,
				private readonly methodName: string ) { 
		super ()
		this.name = methodName
		this.label = methodName 
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		const start = Date.now();

		let itemPath = vscode.workspace.asRelativePath(item.uri!.fsPath)
		itemPath = itemPath + "#" + item.label;
		const workspaceDir = vscode.workspace.workspaceFolders?.map(item => item.uri.fsPath);

		var cmd = vscode.workspace.getConfiguration('ablunit').get('runTestCommand', '').trim();
		if (!cmd) { cmd = '_progres -b -p ABLUnitCore.p -basekey INI -ininame progress.ini -param "${itemPath} CFG=ablunit.json"' }
		cmd = cmd.replace("${itemPath}",itemPath);

		await new Promise<string>((resolve, reject) => {
			cp.exec(cmd, { cwd: workspaceDir?.toString() }, (err, stdout, stderr) => {
				if (err) {
					options.appendOutput(stderr);
					reject(err);
				}
				options.appendOutput(stdout);
				return resolve(stdout);
			});
		});
		const duration = Date.now() - start;

		const resultsPath = vscode.workspace.getConfiguration('ablunit').get('resultsPath', '').trim();
		const resultsUri = vscode.Uri.joinPath(this.workspaceDir(),"/results.xml")
		const ablResults = new ABLResultsParser()
		await ablResults.importResults(resultsUri)
		const results = ablResults.resultsJson

		if(!results || !results.name){
			options.errored(item, new vscode.TestMessage("cannot find top node `testsuites` in results.xml"))
			return
		} else if(!results.testsuite) {
			options.errored(item, new vscode.TestMessage("cannot find testsuite in results.xml"))
			return
		} if (results.testsuite.length > 1) {
			options.errored(item, new vscode.TestMessage("invalid results.xml - should only have 1 test suite"))
		} else {
			if (results.testsuite[0].tests > 0) {
				if(results.testsuite[0].errors == 0 && results.testsuite[0].failures == 0) {
					options.passed(item)
				} else if (results.testsuite[0].tests = results.testsuite[0].skipped) {
					options.skipped(item)
				} else if (results.testsuite[0].failures > 0 || results.testsuite[0].errors > 0) {
					options.failed(item, new vscode.TestMessage("one or more tests failed"), results.testsuite[0].time)
				} else {
					options.errored(item, new vscode.TestMessage("unknown error - test results are all zero"), results.testsuite[0].time)
				}
			}

			const testcases = results.testsuite[0].testcases
			if(testcases) {

				item.children.forEach(child => {
					if (testcases?.length) {
						for(let idx=0; idx<testcases.length; idx++) {
							const tc = testcases[idx]
							if (child.label == tc.name) {
							}
						}
					}
				})
			}
		}
	}

}

export class ABLTestProcedure extends TestTypeObj { // child of TestProgram
	public description: string = "ABL Test Procedure"

	constructor(public generation: number,
				private readonly programname: string,
				private readonly procedurename: string) { 
		super()
		this.label = procedurename
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		// console.log("ABLTestProcedure.run() TODO")
	}

}

export class ABLAssert extends TestTypeObj { // child of TestClass or TestProcedure
	public canResolveChildren: boolean = false
	public runnable: boolean = false
	
	constructor(
		public generation: number,
		private readonly assertText: string
	) { super() }

	getLabel() {
		return this.assertText
	}
}
