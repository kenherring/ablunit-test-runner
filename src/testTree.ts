import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { parseABLUnit } from './parser';
import { getFailureMarkdownMessage, parseABLCallStack } from './ablHelper';
import { ABLResultsParser, TestCase } from './parse/ablResultsParser';
import * as cp from "child_process";
import { timeStamp } from 'console';
import { ABLProfile } from './parseABLProfile';
import { Module, LineSummary } from './ABLProfileSections';
import { getSourceLine } from './ABLDebugLines';

const textDecoder = new TextDecoder('utf-8');

export type ABLUnitTestData = ABLTestSuiteClass | ABLTestProgramDirectory | ABLTestClassNamespace | ABLTestClass | ABLTestProgram | ABLTestMethod | ABLTestProcedure | ABLAssert

export const testData = new WeakMap<vscode.TestItem, ABLUnitTestData>();
export const testCoverage: Map<string, vscode.FileCoverage> = new Map<string, vscode.FileCoverage>();

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

	public fileCoverage: vscode.FileCoverage[] = []

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

	protected workspaceUri = () => {
		const workspaceDir = vscode.workspace.workspaceFolders?.map(item => item.uri)[0]
		if (!workspaceDir) {
			throw ("no workspace directory opened")
		}
		return vscode.Uri.file(workspaceDir.fsPath)
	}

	protected resultsUri = () => {
		var resultsFile = vscode.workspace.getConfiguration('ablunit').get('resultsPath', '')
		if(!resultsFile) {
			throw ("no workspace directory opened")
		}
		if(resultsFile == "") {
			resultsFile = "results.xml"
		}

		if (resultsFile.startsWith("/") || resultsFile.startsWith("\\")) {
			const uri = vscode.Uri.file(resultsFile)
			if (uri) {
				return uri
			}
		}
		return vscode.Uri.joinPath(this.workspaceUri(), resultsFile)
	}

	protected profilerUri = () => {
		var profilerFile = vscode.workspace.getConfiguration('ablunit').get('profileOutputPath', '')
		if(!profilerFile) {
			throw ("no workspace directory opened")
		}
		if(profilerFile == "") {
			profilerFile = "results.prof"
		}

		if (profilerFile.startsWith("/") || profilerFile.startsWith("\\")) {
			const uri = vscode.Uri.file(profilerFile)
			if (uri) {
				return uri
			}
		}
		return vscode.Uri.joinPath(this.workspaceUri(), profilerFile)
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
			// if (item.children.size == 0) {
			// 	controller.items.delete(item.id)
			// 	return
			// }

			if(this.replaceWith != undefined) {
				const currItem = controller.items.get(this.replaceWith.id)

				if (currItem) {
					this.addItemsToController(currItem, this.replaceWith)
				} else {
					controller.items.add(this.replaceWith)
					// controller.items.delete(item.id)
				}
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
		if (!this.workspaceUri()) {
			throw ("no workspace directory opened")
		}
		// console.log("getProgressIni workspaceDir=" + this.workspaceUri())

		//first, check if the progressIni config is set for the workspace
		const configIni = vscode.workspace.getConfiguration('ablunit').get('progressIni', '')
		if (configIni != '') {
			const uri1 = vscode.Uri.joinPath(this.workspaceUri(), configIni)
			// console.log("uri1=" + uri1)
			if(uri1){
				return uri1
			}
		}

		//second, check if there is a progress ini in the root of the repo
		// console.log("workspaceDir=" + this.workspaceUri())
		if(this.workspaceUri()) {
			const uri2 = vscode.Uri.joinPath(this.workspaceUri(), 'progress.ini')
			// console.log("uri2=" + uri2)
			if (uri2) {
				return uri2
			}
		}

		//third, check if the workspace has a temp directory configured
		const uri3 = vscode.Uri.parse(vscode.workspace.getConfiguration('ablunit').get('tempDir', ''))
		// console.log("uri3=" + uri3)
		if (uri3) {
			return uri3
		}

		//fourth, and lastly, use the extension temp directory
		if(this.storageUri) {
			const stat1 = vscode.workspace.fs.stat(this.storageUri)
			if(!stat1) {
				vscode.workspace.fs.createDirectory(this.storageUri)
			}
			const stat2 = vscode.workspace.fs.stat(this.storageUri)

			const uri4 = vscode.Uri.joinPath(this.storageUri, 'progress.ini')
			// console.log("uri4=" + uri4)
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

	createProfileOptions (profileOptions: vscode.Uri) {
		const profOpts = [ "-coverage", "-description \"ABLUnit\"", "-filename results.prof" ]
		vscode.workspace.fs.writeFile(profileOptions, Uint8Array.from(Buffer.from(profOpts.join("\n"))))
	}

	getCommand(itemPath: string): string {
		if(!this.storageUri) {
			throw ("temp directory not set")
		}
		// vscode.workspace.fs.createDirectory(this.storageUri)

		var cmd = vscode.workspace.getConfiguration('ablunit').get('tests.command', '').trim();
		if (! cmd) {
			cmd = '_progres -b -p ABLUnitCore.p ${progressIni} -param "${itemPath} CFG=${ablunit.json}" -profile "${profile.options}"';
		}

		const ablunitJson = vscode.Uri.joinPath(this.workspaceUri(), "ablunit.json").fsPath
		const profileOptions = vscode.Uri.joinPath(this.workspaceUri(), "profile.options")

		cmd = cmd.replace("${itemPath}",itemPath)
		cmd = cmd.replace("${ablunit.json}",ablunitJson)
		cmd = cmd.replace("${profile.options}",profileOptions.fsPath)

		// need to promisify
		// const profileOptFile = vscode.workspace.fs.stat(profileOptions).then((stat) => { return true }, (err) => { return false })
		// if (! profileOptFile) {
		if (true) {
			this.createProfileOptions(profileOptions)
		}

		if (process.platform === 'win32') {
			const progressIni = this.getProgressIni()
			if (!progressIni) { throw ("cannot find progress.ini or suitable location to write one") }
			const progressIniStat = vscode.workspace.fs.stat(progressIni)
			if(! progressIniStat) {
				this.createProgressIni(progressIni)
			}
			cmd = cmd.replace("${progressIni}","-basekey INI -ininame " + progressIni.fsPath);
		} else {
			cmd = cmd.replace("${progressIni}","");
		}

		console.log("cmd='" + cmd + "'")
		return cmd
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		const start = Date.now()
		let itemPath = vscode.workspace.asRelativePath(item.uri!.fsPath)

		const cmd: string = this.getCommand(itemPath)
		const notificationsEnabled = vscode.workspace.getConfiguration('ablunit').get('notificationsEnabled', true)


		if (notificationsEnabled) {
			vscode.window.showInformationMessage("running ablunit tests");
		}
		console.log("ShellExecution Started - " + this.workspaceUri().fsPath)
		const dir = this.workspaceUri().fsPath

		// await new Promise<string>((resolve, reject) => {
		// 	vscode.tasks.executeTask(
		// 		new vscode.Task(
		// 			{ type: 'process' },
		// 			vscode.TaskScope.Workspace,
		// 			"ablunit run tests",
		// 			"ablunit-test-provider",
		// 			new vscode.ShellExecution(cmd, { cwd: dir })));
		// });

		await new Promise<string>((resolve, reject) => {
			cp.exec(cmd, { cwd: dir }, (err:any, stdout: any, stderr: any) => {
				// console.log('stdout: ' + stdout);
				// console.log('stderr: ' + stderr);
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
		const duration = Date.now() - start
		console.log("ShellExecution Completed - duration: " + duration)
		if (notificationsEnabled) {
			vscode.window.showInformationMessage("ablunit tests complete");
		}


		await this.parseResults(item, options, duration)
		await this.parseProfile()
	}

	async parseResults (item: vscode.TestItem, options: vscode.TestRun, duration: number) {
		if (!this.workspaceUri()) {}
		const resultsUri = this.resultsUri()
		const ablResults = new ABLResultsParser()
		await ablResults.importResults(resultsUri)
		const res = ablResults.resultsJson


		if(!res || !res['testsuite']) {
			console.log("malformed results - could not find 'testsuite' node")
			options.errored(item, new vscode.TestMessage("malformed results - could not find 'testsuite' node"), duration)
			return
		}

		const s = res.testsuite.find((s: any) => s = item.id)
		if (!s) {
			console.log("could not find test suite in results")
			options.errored(item, new vscode.TestMessage("could not find test suite in results"), duration)
			return
		}

		const td = testData.get(item)
		if (td && (td instanceof ABLTestProcedure || td instanceof ABLTestMethod)) {
			// Test Procedure type
			if(s.testcases) {
				const tc = s.testcases.find(tc => tc.name === item.label)
				if(tc) {
					await this.setChildResults(item, options, tc)
				}
			}
			return
		}

		// TestFile type
		if (s.tests > 0) {
			if(s.errors == 0 && s.failures == 0) {
				options.passed(item, s.time)
			} else if (s.tests = s.skipped) {
				options.skipped(item)
			} else if (s.failures > 0 || s.errors > 0) {
				//// This should be populated automatically by the child messages filtering up
				// options.failed(item, new vscode.TestMessage("one or more tests failed"), s.time)
			} else {
				options.errored(item, new vscode.TestMessage("unknown error - test results are all zero"), s.time)
			}
		}

		if (!s.testcases) {
			options.errored(item, new vscode.TestMessage("malformed results - could not find 'testcases' node"), duration)
			return
		}

		const promArr: Promise<void>[] = [Promise.resolve()]
		item.children.forEach(child => {
			const tc = s.testcases?.find(t => t.name === child.label)
			if(!tc) {
				options.errored(child, new vscode.TestMessage("could not find result for test case"))
				return
			}
			promArr.push(this.setChildResults(child, options, tc))
		})
		return Promise.all(promArr)
	}

	parseProfile() {
		const profilerUri = this.profilerUri()
		var profParser = new ABLProfile(profilerUri)
		profParser.writeJsonToFile(vscode.Uri.joinPath(this.workspaceUri(), "profiler.json"))
		const profOutput = profParser.profJSON

		testCoverage.clear()

		profOutput.modules.forEach((module: Module) => {
			if (!module.SourceName || module.SourceName.startsWith("OpenEdge") || module.SourceName == "ABLUnitCore.p") {
				return
			}

			const moduleUri = vscode.Uri.joinPath(this.workspaceUri(), module.SourceName)
			var fc: vscode.FileCoverage | undefined = undefined

			module.lines.forEach((line: LineSummary) => {
				if (line.LineNo <= 0) {
					//TODO: -2 is a special case - need to handle this better
					//TODO: 0 is a special case
					return
				}

				const dbg = getSourceLine(moduleUri, line.LineNo)
				if (!dbg) {
					console.error("cannot find dbg for " + moduleUri.fsPath)
					return
				}

				if (!fc || fc.uri.fsPath != dbg.incUri.fsPath) {
					//get existing FileCoverage object
					fc = testCoverage.get(dbg.incUri.fsPath)
					if (!fc) {
						//create a new FileCoverage object if one didn't already exist
						fc = new vscode.FileCoverage(dbg.incUri, new vscode.CoveredCount(0,0))
						testCoverage.set(fc.uri.fsPath, fc)
					}
				}
				if (!fc) {
					throw ("ERROR: cannot find or create fc")
				}
				if (!fc.detailedCoverage) {
					fc.detailedCoverage = []
				}
				fc.detailedCoverage.push(new vscode.StatementCoverage(line.ExecCount ?? 0,
					new vscode.Range(new vscode.Position(dbg.incLine - 1 ,0),new vscode.Position(dbg.incLine,0))))
			});
		});

		// TODO - turn this into TestCoverage class objects
		//      - will be useful when the proposed API is finalized
	}

	async setChildResults(item: vscode.TestItem, options: vscode.TestRun, tc: TestCase) {
		switch(tc.status) {
			case "Success":
				options.passed(item, tc.time)
				return
			case "Failure":
				if (tc.failure) {
					return getFailureMarkdownMessage(tc.failure).then((msg) => {
						options.failed(item, [
							new vscode.TestMessage(msg)
						], tc.time)
					})
				}
				throw("unexpected failure")
			case "Error":
				if (tc.error) {
					return getFailureMarkdownMessage(tc.error).then((msg) => {
						options.failed(item, [
							new vscode.TestMessage(msg)
						], tc.time)
					})
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

export class ABLTestSuiteClass extends TestFile {

	constructor(
		public generation: number,
		private readonly suiteName: string
	) { super() }

	getLabel() {
		return this.suiteName
	}
}

export class ABLTestClassNamespace extends TestFile {
	public canResolveChildren: boolean = false

	constructor(
		public generation: number,
		private readonly classpath: string,
		private readonly element: string
	) { super() }

	getLabel() {
		return this.element
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
				this.testFileType = "ABLTestSuite"
				const parent = ancestors[ancestors.length - 1]
				const id = `${item.uri}/${suiteName}`

				const thead = controller.createTestItem(id, suiteName, item.uri)
				thead.range = range
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestSuite") ]
				testData.set(thead, new ABLTestSuiteClass(thisGeneration, suiteName))
				parent.children.push(thead)
				ancestors.unshift({ item: thead, children: [] })
			},

			onTestClassNamespace: (range: vscode.Range, classpath: string, element: string, classpathUri: vscode.Uri) => {
				this.testFileType = "ABLTestClassNamespace2"
				const id = `classpath:${classpath}`
				const thead = controller.createTestItem(id, classpath, classpathUri)
				thead.range = range
				// if (element == "classpath root") {
				// 	thead.tags = [ new vscode.TestTag("ABLTestClassNamespace") ]
				// } else {
				// 	thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClassNamespace") ]
				// }
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClassNamespace") ]
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

			onTestProgramDirectory (range: vscode.Range, programname: string, dir: string) { console.error("should not be here! programname=" + programname + " dir=" + dir) },

			onTestProgram: (range: vscode.Range, relativepath: string, label: string, programUri: vscode.Uri) => { console.error("should not be here! relativepath=" + relativepath) },

			onTestProcedure: (range: vscode.Range, programname: string, procedurename: string, programUri) => { console.log("should not be here! programname=" + programname + " procedurename=" + procedurename) },

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

			onTestMethod: (range: vscode.Range, classname: string, methodname: string) => { console.error("onTestMethod") },

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

			onTestProcedure: (range: vscode.Range, relativePath: string, procedureName: string, programUri: vscode.Uri) => {
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
}

export class ABLTestMethod extends TestFile { // child of TestClass

	constructor(public generation: number,
				private readonly classname: string,
				private readonly methodName: string ) {
		super()
	}
}

export class ABLTestProcedure extends TestFile { // child of TestProgram
	public description: string = "ABL Test Procedure"

	constructor(public generation: number,
				private readonly programname: string,
				private readonly procedurename: string) {
		super()
		this.label = procedurename
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
