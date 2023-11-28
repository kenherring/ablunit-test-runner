import * as vscode from 'vscode'
import { TextDecoder } from 'util'
import { ABLResults } from './ABLResults'
import { parseABLTestSuite } from './parse/TestSuiteParser'
import { parseABLTestClass } from './parse/TestClassParser'
import { parseABLTestProgram } from './parse/TestProgramParser'

const textDecoder = new TextDecoder('utf-8')

// export type ABLUnitTestData = ABLTestSuite | ABLTestProgramDirectory | ABLTestClassNamespace | ABLTestClass | ABLTestProgram | ABLTestMethod | ABLTestProcedure | ABLAssert
export type ABLUnitTestData = ABLTestSuite | ABLTestProgramDirectory | ABLTestClass | ABLTestProgram | ABLTestMethod | ABLTestProcedure | ABLAssert

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
	public testFileType = "TestFile"
	protected replaceWith: vscode.TestItem | undefined = undefined
	currentResults?: ABLResults

	public async updateFromDisk(controller: vscode.TestController, item: vscode.TestItem) {
		try {
			const content = await getContentFromFilesystem(item.uri!)
			item.error = undefined
			this.updateFromContents(controller, content, item)

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
			item.error = (e as Error).stack
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
			const finished = ancestors.pop()!
			finished.item.children.replace(finished.children)
			this.replaceWith = finished.item
		}
	}

	public updateFromContents(controller: vscode.TestController, content: string, item: vscode.TestItem) {
		console.error("updateFromContents TestFile - skipping")
	}
}

export class ABLTestSuite extends TestFile {

	setSuiteInfo(relativePath: string, suiteName: string) {
		this.name = relativePath
		this.label = suiteName
	}

	public updateFromContents(controller: vscode.TestController, content: string, item: vscode.TestItem) {
		const ancestors: [{ item: vscode.TestItem, children: vscode.TestItem[] }] = [{ item, children: [] as vscode.TestItem[] }]
		ancestors.pop()
		this.didResolve = true
		const relativePath = vscode.workspace.asRelativePath(item.uri!.fsPath)

		parseABLTestSuite(content, relativePath, {

			onTestSuite: (range: vscode.Range, relativePath: string, suiteName:string) => {
				this.testFileType = "ABLTestSuite"

				const id = `${relativePath}`
				const thead = controller.createTestItem(id, suiteName, item.uri)
				thead.range = range
				thead.label = suiteName
				thead.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestSuite")]
				const tData = new ABLTestSuite()
				this.setSuiteInfo(relativePath, suiteName)
				testData.set(thead, tData)

				const parent = ancestors[ancestors.length - 1]
				if (ancestors.length < 1) {
					const grp = controller.createTestItem('ABLTestSuiteGroup',"[ABLUnit Test Suites]")
					grp.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestSuiteGroup")]
					ancestors.push({ item: grp, children: [thead] as vscode.TestItem[] })
				} else {
					parent.children.push(thead)
				}
				ancestors.push({ item: thead, children: [] as vscode.TestItem[] })
			},

			onTestClass: (range: vscode.Range, relativePath: string, classpath: string, label: string, suiteName?: string) => {
				this.testFileType = "ABLTestClass"

				const id = `${relativePath}`
				const thead = controller.createTestItem(id, relativePath, item.uri)
				thead.range = range
				thead.label = label
				thead.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClass")]
				const tData = new ABLTestClass()
				tData.setClassInfo(relativePath, label)
				testData.set(thead, tData)

				const parent = ancestors[ancestors.length - 1]
				if (parent) {
					parent.children.push(thead)
				}
				if (!suiteName) {
					ancestors.push({ item: thead, children: [] as vscode.TestItem[] })
				}
			},

			onTestProgram: (range: vscode.Range, relativepath: string, label: string, suiteName?: string) => {
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
				if (!suiteName) {
					ancestors.push({ item: thead, children: [] as vscode.TestItem[] })
				}
			},

		})

		this.ascend(0, ancestors) // finish and assign children for all remaining items
	}
}

export class ABLTestProgramDirectory extends TestTypeObj {
	public canResolveChildren: boolean = false

	constructor(public generation: number, private readonly relativeDir: string, private readonly element: string) {
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
		const thisGeneration = generationCounter++
		this.didResolve = true
		const relativePath = vscode.workspace.asRelativePath(item.uri!.fsPath)

		parseABLTestClass(content, relativePath, {

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

			onTestClass: (range: vscode.Range, relativePath: string, classpath: string, label: string, suiteName?: string) => {
				this.testFileType = "ABLTestClass"

				const id = `${relativePath}`
				const thead = controller.createTestItem(id, relativePath, item.uri)
				thead.range = range
				thead.label = label
				thead.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClass")]
				const tData = new ABLTestClass()
				tData.setClassInfo(relativePath, label)
				testData.set(thead, tData)

				const parent = ancestors[ancestors.length - 1]
				if (parent) {
					parent.children.push(thead)
				}
				if (!suiteName) {
					ancestors.push({ item: thead, children: [] as vscode.TestItem[] })
				}
			},

			onTestMethod: (range: vscode.Range, relativePath: string, classpath: string, methodname: string) => {
				this.testFileType = "ABLTestMethod"
				const id = `${relativePath}#${methodname}`
				const thead = controller.createTestItem(id, methodname, item.uri)
				thead.range = range
				thead.tags = [new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestMethod")]
				thead.label = methodname
				testData.set(thead, new ABLTestMethod(thisGeneration, relativePath, classpath, methodname))
				const parent = ancestors[ancestors.length - 1]
				parent.children.push(thead)
				item.children.add(thead)
			}

		})

		this.ascend(0, ancestors) // finish and assign children for all remaining items
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
		const thisGeneration = generationCounter++
		this.didResolve = true
		const relativePath = vscode.workspace.asRelativePath(item.uri!.fsPath)

		parseABLTestProgram(content, relativePath, {

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

			onTestProgram: (range: vscode.Range, relativepath: string, label: string, suiteName?: string) => {
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
				if (!suiteName) {
					ancestors.push({ item: thead, children: [] as vscode.TestItem[] })
				}
			},

			onTestProcedure: (range: vscode.Range, relativePath: string, procedureName: string) => {
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

		})

		this.ascend(0, ancestors) // finish and assign children for all remaining items
	}
}

export class ABLTestMethod extends TestFile { // child of TestClass
	constructor(public generation: number, private readonly relativePath: string, private readonly classname: string, private readonly methodName: string) {
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
