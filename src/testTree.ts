import { Range, TestController, TestItem, TestItemCollection, TestTag, Uri, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { parseABLTestSuite } from './parse/TestSuiteParser'
import { parseABLTestClass } from './parse/TestClassParser'
import { parseABLTestProgram } from './parse/TestProgramParser'
import { getContentFromFilesystem } from './parse/ProfileParser'

export type ABLUnitTestData = ABLTestDir | ABLTestFile | ABLRunnable | ABLAssert
export type ABLRunnable = ABLTestSuite | ABLTestClass | ABLTestProgram | ABLTestMethod | ABLTestProcedure
export type TestFile = ABLTestSuite | ABLTestClass | ABLTestProgram


export const testData = new WeakMap<TestItem, ABLUnitTestData>()
const displayClassLabel = workspace.getConfiguration('ablunit').get('display.classLabel','')

interface IAncestor {
	item: TestItem
	children: TestItem[]
}

interface ITestType {
	isFile: boolean
	didResolve: boolean
	name: string
	runnable: boolean
	canResolveChildren: boolean
}

function gatherTestItems(collection: TestItemCollection) {
	const items: TestItem[] = []
	collection.forEach(item => items.push(item))
	return items
}

//@deprecate
function createTestItem(controller: TestController,
						item: TestItem,
						range: Range | undefined,
						id: string,
						label: string,
						tag: string,
						description?: string) {
	const thead = controller.createTestItem(id, label, item.uri)
	thead.description = description
	thead.range = range
	thead.tags = [new TestTag("runnable"), new TestTag(tag)]
	return thead
}

function createTestChild(controller: TestController,
						range: Range,
						procedureName: string,
						relativePath: string,
						uri: Uri) {
	const child = controller.createTestItem(relativePath + '#' + procedureName, procedureName, uri)
	child.range = range
	child.label = procedureName
	child.tags = [new TestTag("runnable"), new TestTag("ABLTestProcedure")]
	child.canResolveChildren = false
	child.description = "ABL Test Procedure"
	return child
}


class TestTypeObj implements ITestType {
	public isFile = false
	public didResolve = false
	public name = ""
	public runnable = false
	public canResolveChildren = false
}

export class ABLTestDir implements ITestType {
	public isFile = false
	public didResolve = true
	public name = "TestDirName"
	public runnable = true
	public canResolveChildren = false
}

export class ABLTestCase extends TestTypeObj {
	public testCaseType = "TestCase"
	public runnable = true
	public canResolveChildren = true
}

export class ABLTestFile extends TestTypeObj {
	public isFile: boolean = true
	public runnable: boolean = true
	public canResolveChildren: boolean = false
	public relativePath: string = ''
	protected replaceWith: TestItem | undefined = undefined
	currentResults?: ABLResults

	public async updateFromDisk(controller: TestController, item: TestItem) {
		try {
			const content = await getContentFromFilesystem(item.uri!)
			if(!content) { return }
			item.error = undefined
			this.updateFromContents(controller, content, item)

			// if (this.replaceWith != undefined) {
			// 	const currItem = controller.items.get(this.replaceWith.id)

			// 	if (currItem) {
			// 		this.addItemsToController(currItem, this.replaceWith)
			// 	} else {
			// 		controller.items.add(this.replaceWith)
			// 	}
			// 	controller.items.delete(item.id)
			// } else {
			// 	//this is definitely valid for classes - not sure about other types
			// 	//if a class has no @test annotations it won't have any children to display
			// 	const hasCurrent = controller.items.get(item.id)
			// 	if (hasCurrent) {
			// 		controller.items.delete(item.id)
			// 	}
			// }
			// controller.items.delete(item.id)
		} catch (e) {
			item.error = (e as Error).stack
		}
	}

	// addItemsToController(item: TestItem, addItem: TestItem) {
	// 	addItem.children.forEach(addChild => {
	// 		const currChild = item.children.get(addChild.id)
	// 		if (currChild) {
	// 			this.addItemsToController(currChild, addChild)
	// 		} else {
	// 			item.children.add(addChild)
	// 		}
	// 	})
	// }

	// ascend(depth: number, ancestors: IAncestor[]) {
	// 	while (ancestors.length > depth) {
	// 		const finished = ancestors.pop()!
	// 		finished.item.children.replace(finished.children)
	// 		this.replaceWith = finished.item
	// 	}
	// }

	updateFromContents(controller: TestController, content: string, item: TestItem) {
		throw new Error("Method not implemented.")
	}

	addToParent(ancestors: IAncestor[], item: TestItem, push: boolean = false) {
		if (ancestors.length > 0) {
			const parent = ancestors[ancestors.length - 1]
			parent.children.push(item)
		}
		if (!push) {
			ancestors.push({ item: item, children: [] })
		}
	}
}

export class ABLTestSuite extends ABLTestFile {

	setSuiteInfo(relativePath: string, suiteName: string) {
		this.name = relativePath
	}

	public updateFromContents(controller: TestController, content: string, item: TestItem) {
		const ancestors: IAncestor[] = []
		this.didResolve = true
		this.relativePath = workspace.asRelativePath(item.uri!.fsPath)

		const items = gatherTestItems(controller.items)

		parseABLTestSuite(content, this.relativePath, {
			onTestSuite: (range: Range, relativePath: string, suiteName:string) => {
				this.name = relativePath
				const thead = createTestItem(controller, item, range, relativePath, suiteName, "ABLTestSuite")
				testData.set(thead, this)

				const parent = ancestors[ancestors.length - 1]
				if (ancestors.length < 1) {
					const grp = controller.createTestItem('ABLTestSuiteGroup',"[ABLUnit Test Suites]")
					grp.tags = [new TestTag("runnable"), new TestTag("ABLTestSuiteGroup")]
					ancestors.push({ item: grp, children: [thead] })
				} else {
					parent.children.push(thead)
				}
				ancestors.push({ item: thead, children: [] })
			},
			onTestClass: (range: Range, relativePath: string, classpath: string, label: string, suiteName?: string) => {
				const existing = items.find(item => item.id == relativePath)
				if (existing) {
					if(existing.parent) {
						existing.parent.children.delete(existing.id)
					}
					this.addToParent(ancestors, existing)
					return
				}

				const thead = createTestItem(controller, item, range, relativePath, label, "ABLTestClass")
				const tData = new ABLTestClass()
				tData.setClassInfo(relativePath, classpath, label)
				testData.set(thead, tData)
				this.addToParent(ancestors, thead)
			},
			onTestProgram: (range: Range, relativepath: string, label: string, suiteName?: string) => {
				const existing = items.find(item => item.id == relativepath)
				if (existing) {
					if(existing.parent) {
						existing.parent.children.delete(existing.id)
					}
					this.addToParent(ancestors, existing)
					return
				}

				const thead = createTestItem(controller, item, range, relativepath, label, "ABLTestProgram")
				const tData = new ABLTestProgram()
				tData.setProgramInfo(relativepath, label)
				testData.set(thead, tData)
				this.addToParent(ancestors, thead)
			}
		})

		// this.ascend(0, ancestors) // finish and assign children for all remaining items
	}
}

export class ABLTestClass extends ABLTestFile {
	public canResolveChildren: boolean = true
	public classpath: string = ''
	public classlabel: string = ''
	methods: ABLTestMethod[] = []

	setClassInfo(relativePath: string, classpath: string, classlabel: string) {
		this.name = relativePath
		this.classpath = classpath
		this.classlabel = classlabel
	}

	addMethod(method: ABLTestMethod) {
		this.methods[this.methods.length] = method
	}

	public updateFromContents(controller: TestController, content: string, item: TestItem) {
		const ancestors: IAncestor[] = []
		this.didResolve = true
		this.relativePath = workspace.asRelativePath(item.uri!.fsPath)

		const response = parseABLTestClass(workspace.getWorkspaceFolder(item.uri!)!, displayClassLabel, content, this.relativePath)

		if(!response) {
			testData.delete(item)
			item.parent?.children.delete(item.id)
			return
		}

		item.description = "TestClass"
		item.label = response.classname
		item.range = response.range
		item.tags = [new TestTag("runnable"), new TestTag("ABLTestClass")]
		item.children.replace([])
		item.canResolveChildren = false

		for(const method of response.methods) {
			if(!method) { continue }
			const child = createTestChild(controller, method.range, method.methodname, response.classname, item.uri!)
			const methodObj = new ABLTestMethod(response.classname, response.classname, method.methodname)
			this.addMethod(methodObj)
			item.children.add(child)
		}
	}
}

export class ABLTestProgram extends ABLTestFile {
	public canResolveChildren: boolean = true
	procedures: ABLTestProcedure[] = []

	setProgramInfo(programname: string, programlabel: string) {
		this.name = programname
	}

	addChild(item: TestItem, proc: ABLTestProcedure) {
		this.procedures.push(proc)
		testData.set(item, new ABLTestProcedure(this.relativePath, proc.name))
	}

	public updateFromContents(controller: TestController, content: string, item: TestItem) {
		const ancestors: IAncestor[] = []
		this.didResolve = true
		this.relativePath = workspace.asRelativePath(item.uri!.fsPath)

		const response = parseABLTestProgram(content, this.relativePath)

		if(!response) {
			testData.delete(item)
			item.parent?.children.delete(item.id)
			return
		}

		item.description = "TestProgram"
		item.label = response.label
		item.range = new Range(0,0,0,0)
		item.tags = [new TestTag("runnable"), new TestTag("ABLTestProgram")]
		item.children.replace([])
		item.canResolveChildren = false

		for(const procedure of response.procedures) {
			if(!procedure) { continue }
			const child = createTestChild(controller, procedure.range, procedure.procedureName, response.label, item.uri!)
			const method = new ABLTestProcedure(response.label, procedure.procedureName)
			this.addChild(child, method)
			item.children.add(child)
		}

	}
}

export class ABLTestMethod extends ABLTestCase { // child of TestClass
	public description = "ABL Test Method"
	constructor(private readonly relativePath: string, private readonly classname: string, private readonly methodName: string) {
		super()
	}
}

export class ABLTestProcedure extends ABLTestCase { // child of TestProgram
	public description = "ABL Test Procedure"
	constructor(private readonly programname: string, private readonly procedurename: string) {
		super()
	}
}

export class ABLAssert extends TestTypeObj { // child of TestMethod or TestProcedure
	public canResolveChildren: boolean = false
	public runnable: boolean = false

	constructor(private readonly assertText: string) {
		super()
	}
}
