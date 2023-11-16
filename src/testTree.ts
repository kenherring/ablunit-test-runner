import * as vscode from 'vscode';
import { parseABLUnit } from './parse/SourceParser';
import { TextDecoder } from 'util';
import { ABLResults } from './ABLResults';
import { ablunitRun } from './ABLUnitRun';
import { ablunitConfig } from './ABLUnitConfigWriter';

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

	run(item: vscode.TestItem, options: vscode.TestRun) {
		if (!resultData) {
			throw new Error("no result data")
		}
		this.currentResults = resultData.get(options)
		this.currentResults!.setTestData(testData)
		return ablunitRun(item, ablunitConfig, options, testData.get(item)!, this.currentResults!).then()
	}
}

export class ABLTestSuiteClass extends TestFile {
	constructor(public generation: number, private readonly suiteName: string) {
		super()
		this.label = suiteName
	}
}

export class ABLTestClassNamespace extends TestFile {
	public canResolveChildren: boolean = false

	constructor(public generation: number, private readonly classpath: string, private readonly element: string) {
		super()
		this.label = element
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
		const relativePath = vscode.workspace.asRelativePath(item.uri!.fsPath)

		parseABLUnit(content, relativePath, {

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

	constructor(public generation: number, private readonly relativeDir: string, private readonly element: string) {
		super()
		this.label = element
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
		const relativePath = vscode.workspace.asRelativePath(item.uri!.fsPath)

		parseABLUnit(content, relativePath, {

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
	constructor(public generation: number, private readonly classname: string, private readonly methodName: string) {
		super()
		this.label = methodName
	}
}

export class ABLTestProcedure extends TestFile { // child of TestProgram
	public description: string = "ABL Test Procedure"

	constructor(public generation: number, private readonly programname: string, private readonly procedurename: string) {
		super()
		this.label = procedurename
	}
}

export class ABLAssert extends TestTypeObj { // child of TestClass or TestProcedure
	public canResolveChildren: boolean = false
	public runnable: boolean = false

	constructor(public generation: number, private readonly assertText: string) {
		super()
		this.label = assertText
	}
}
