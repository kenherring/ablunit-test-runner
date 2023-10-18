import { ABLUnitConfig } from './ABLUnitConfig';
import { parseABLUnit } from './parser';
import { TextDecoder } from 'util';
import { outputChannel } from './ABLUnitCommon';
import * as cp from "child_process";
import * as vscode from 'vscode';
import { ABLResults } from './ABLResults';

const textDecoder = new TextDecoder('utf-8');

export type ABLUnitTestData = ABLTestSuiteClass | ABLTestProgramDirectory | ABLTestClassNamespace | ABLTestClass | ABLTestProgram | ABLTestMethod | ABLTestProcedure | ABLAssert

export const testData = new WeakMap<vscode.TestItem, ABLUnitTestData>()
export const resultData = new WeakMap<vscode.TestRun, ABLResults>()

let generationCounter = 0

export const getContentFromFilesystem = async (uri: vscode.Uri) => {
	try {
		const rawContent = await vscode.workspace.fs.readFile(uri)
		return textDecoder.decode(rawContent)
	} catch (e) {
		console.warn(`Error providing tests for ${uri.fsPath}`, e)
		return ''
	}
}

class TestTypeObj {
	public didResolve: boolean = false
	public name: string = ""
	public label: string = ""

	public fileCoverage: vscode.FileCoverage[] = []

	getLabel() {
		return this.label
	}
}

class TestFile extends TestTypeObj {
	public testFileType = "TestFile";
	protected replaceWith: vscode.TestItem | undefined = undefined
	currentResults?: ABLResults

	public async updateFromDisk(controller: vscode.TestController, item: vscode.TestItem) {
		try {
			const content = await getContentFromFilesystem(item.uri!);
			item.error = undefined;
			this.updateFromContents(controller, content, item);

			if (this.replaceWith != undefined) {
				const currItem = controller.items.get(this.replaceWith.id)

				if (currItem) {
					this.addItemsToController(currItem, this.replaceWith)
				} else {
					controller.items.add(this.replaceWith)
				}
				controller.items.delete(item.id)
			} else {
				//this is definitely valid for classes - not sure about other types
				//if a class has no @test annotations it won't have any children to display
				const hasCurrent = controller.items.get(item.id)
				if (hasCurrent) {
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
		while (ancestors.length > depth) {
			const finished = ancestors.pop()!;
			finished.item.children.replace(finished.children);
			this.replaceWith = finished.item
		}
	}

	public updateFromContents(controller: vscode.TestController, content: string, item: vscode.TestItem) {
		console.error("updateFromContents TestFile - skipping")
	}

	async createAblunitJson(uri: vscode.Uri, itemPath: string) {
		const opt: Options = {
			output: {
				location: this.currentResults!.runConfig.resultsUri!.fsPath,
				format: "xml",
			},
			quitOnEnd: true,
			writeLog: true,
			showErrorMessage: true,
			throwError: true,
			tests: [
				{ test: itemPath }
			]
		}

		this.currentResults!.runConfig.ablunitOptions = opt
		return vscode.workspace.fs.writeFile(uri, Uint8Array.from(Buffer.from(JSON.stringify(opt, null, 2))))
	}

	async getCommand(itemPath: string) {
		itemPath="testMe.cls"
		if (!this.currentResults?.runConfig.tempDirUri) {
			throw (new Error("temp directory not set"))
		}

		const cmd = ['_progres', '-b', '-p', 'ABLUnitCore.p']

		if (process.platform === 'win32') {
			cmd.push('-basekey', 'INI', '-ininame', this.currentResults.runConfig.progressIni!.fsPath)
		}

		const resultsOut = vscode.workspace.asRelativePath(this.currentResults.runConfig.tempDirUri!)
		cmd.push('-T', this.currentResults.runConfig.tempDirUri.fsPath)
		cmd.push('-profile', this.currentResults.runConfig.profileOptions!.fsPath)
		// cmd.push('-param', "'CFG=" + this.currentResults.runConfig.ablunitJson!.fsPath + "'")
		cmd.push("-param", '"' + itemPath + ' -outputLocation ' + resultsOut + ' -format xml"')
		await this.createAblunitJson(this.currentResults.runConfig.ablunitJson!, itemPath)

		const cmdSanitized: string[] = []
		cmd.forEach(element => {
			cmdSanitized.push(element.replace(/\\/g, '/'))
		});

		this.currentResults.runConfig.cmd = cmdSanitized
		outputChannel.appendLine("ABLUnit Command: " + cmdSanitized.join(' '))
		return cmdSanitized
	}

	async run(item: vscode.TestItem, options: vscode.TestRun) {
		const start = Date.now()

		const data = testData.get(item)
		this.currentResults = resultData.get(options)
		if(!this.currentResults) {
			throw new Error("no current results")
		}
		this.currentResults.setTestData(testData)

		let itemPath = item.uri!.fsPath
		if (data instanceof ABLTestProcedure || data instanceof ABLTestMethod) {
			itemPath = itemPath + "#" + item.label
		}

		return this.getCommand(itemPath).then((args) => {
			if (!this.currentResults) {
				throw(new Error("no current results"))
			}

			console.log("ShellExecution Started - dir='" + this.currentResults.runConfig.workspaceDir.fsPath + "'")
			outputChannel.appendLine("ShellExecution Started - dir='" + this.currentResults.runConfig.workspaceDir.fsPath + "'")

			const cmd = args[0]
			args.shift()

			console.log("COMMAND='" + cmd + ' ' + args.join(' ') + "'")
			return new Promise<string>((resolve, reject) => {
				cp.exec(cmd + ' ' + args.join(' '), { cwd: this.currentResults!.runConfig.workspaceDir.fsPath }, (err: any, stdout: any, stderr: any) => {
					// console.log('stdout: ' + stdout)
					// console.log('stderr: ' + stderr)
					if (stderr) {
						console.error(stderr)
						options.appendOutput("ERROR:" + stderr)
						reject(stderr)
					}
					const duration = Date.now() - start
					outputChannel.appendLine("ShellExecution Completed - duration: " + duration)
					console.log("ShellExecution Completed - duration: " + duration)
					console.log(stdout)
					options.appendOutput(stdout)
					return this.currentResults!.parseOutput(item, options).then(() => {
						updateCallStacks(item)
						resolve(stdout)
					}, (err) => {
						throw new Error("error parsing output: " + err)
					})
				})
			})
		})
	}
}

function updateCallStacks (item: vscode.TestItem) {
	console.log('updating call stack for ' + item.label + ' ' + item.id)

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
		const ancestors: [{ item: vscode.TestItem, children: vscode.TestItem[] }] = [{ item, children: [] as vscode.TestItem[] }]
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
				thead.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestSuite")]
				testData.set(thead, new ABLTestSuiteClass(thisGeneration, suiteName))
				parent.children.push(thead)
				ancestors.unshift({ item: thead, children: [] })
			},

			onTestClassNamespace: (range: vscode.Range, classpath: string, element: string, classpathUri: vscode.Uri) => {
				this.testFileType = "ABLTestClassNamespace2"
				const id = `classpath:${classpath}`
				const thead = controller.createTestItem(id, classpath, classpathUri)
				thead.range = range
				thead.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClassNamespace")]
				thead.label = element

				if (ancestors.length > 0) {
					const parent = ancestors[ancestors.length - 1]
					parent.children.push(thead)
				}
				testData.set(thead, new ABLTestClassNamespace(thisGeneration, classpath, element));
				ancestors.push({ item: thead, children: [] as vscode.TestItem[] })
			},

			onTestClass: (range: vscode.Range, classpath: string, label: string) => {
				this.testFileType = "ABLTestClass"

				const id = `${classpath}`
				const thead = controller.createTestItem(id, classpath, item.uri)
				thead.range = range
				thead.label = label
				thead.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClass")]
				const tData = new ABLTestClass()
				tData.setClassInfo(classpath, label)
				testData.set(thead, tData)

				const parent = ancestors[ancestors.length - 1]
				if (parent) {
					parent.children.push(thead)
				}
				ancestors.push({ item: thead, children: [] as vscode.TestItem[] })
			},

			onTestMethod: (range: vscode.Range, classpath: string, methodname: string) => {
				this.testFileType = "ABLTestMethod"
				const id = `${classpath}#${methodname}`
				const thead = controller.createTestItem(id, methodname, item.uri);
				thead.range = range;
				thead.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestMethod")]
				thead.label = methodname
				testData.set(thead, new ABLTestMethod(thisGeneration, classpath, methodname));
				const parent = ancestors[ancestors.length - 1];
				parent.children.push(thead)
				item.children.add(thead)
			},

			onTestProgramDirectory(range: vscode.Range, programname: string, dir: string) { console.error("should not be here! programname=" + programname + " dir=" + dir) },

			onTestProgram: (range: vscode.Range, relativepath: string, label: string, programUri: vscode.Uri) => { console.error("should not be here! relativepath=" + relativepath) },

			onTestProcedure: (range: vscode.Range, programname: string, procedurename: string, programUri) => { console.log("should not be here! programname=" + programname + " procedurename=" + procedurename) },

			onAssert: (range, assertMethod) => {
				this.testFileType = "ABLAssert"
				const parent = ancestors[ancestors.length - 1];
				const id = `${item.uri}/${assertMethod}`;

				const thead = controller.createTestItem(id, assertMethod, item.uri);
				thead.range = range;
				thead.tags = [new vscode.TestTag("not runnable"), new vscode.TestTag("ABLAssert")]
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
		const ancestors: [{ item: vscode.TestItem, children: vscode.TestItem[] }] = [{ item, children: [] as vscode.TestItem[] }]
		ancestors.pop()
		const thisGeneration = generationCounter++;
		this.didResolve = true;

		parseABLUnit(content, vscode.workspace.asRelativePath(item.uri!.fsPath), {

			onTestSuite: (range, suiteName) => { console.error("onTestSuite") },

			onTestClassNamespace: (range, classpath, element) => { console.error("onTestClassNamespace") },

			onTestClass: (range: vscode.Range, classname: string, label: string) => { console.error("onTestClassNamespace") },

			onTestMethod: (range: vscode.Range, classname: string, methodname: string) => { console.error("onTestMethod") },

			onTestProgramDirectory(range: vscode.Range, dirpath: string, dir: string, dirUri: vscode.Uri) {
				const id = `pgmpath:${dirpath}`
				const thead = controller.createTestItem(id, dirpath, dirUri)
				thead.range = range
				thead.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestProgramDirectory")]
				thead.label = dir

				if (ancestors.length > 0) {
					const parent = ancestors[ancestors.length - 1]
					parent.children.push(thead)
				}

				testData.set(thead, new ABLTestProgramDirectory(thisGeneration, dir, dir))
				ancestors.push({ item: thead, children: [] as vscode.TestItem[] })
			},

			onTestProgram: (range: vscode.Range, relativepath: string, label: string, programUri: vscode.Uri) => {
				this.testFileType = "ABLTestProgram"

				const id = `${relativepath}`
				const thead = controller.createTestItem(id, relativepath, item.uri)
				thead.range = range
				thead.label = label
				thead.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestProgram")]
				const tData = new ABLTestProgram()
				tData.setProgramInfo(relativepath, label)
				testData.set(thead, tData)

				const parent = ancestors[ancestors.length - 1]
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
				thead.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestProcedure")]
				testData.set(thead, new ABLTestProcedure(thisGeneration, relativePath, procedureName))

				const parent = ancestors[ancestors.length - 1]
				parent.children.push(thead)
			},

			onAssert: (range, assertMethod) => {
				this.testFileType = "ABLAssert"
				const parent = ancestors[ancestors.length - 1];
				const id = `${item.uri}/${assertMethod}`;

				const thead = controller.createTestItem(id, assertMethod, item.uri);
				thead.range = range;
				thead.tags = [new vscode.TestTag("not runnable"), new vscode.TestTag("ABLAssert")]
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
		private readonly methodName: string) {
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
