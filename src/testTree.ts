import { Range, TestController, TestItem, TestTag, Uri, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { ITestSuite, parseABLTestSuite } from './parse/TestSuiteParser'
import { IClassRet, ITestCase, parseABLTestClass } from './parse/TestClassParser'
import { IProgramRet, parseABLTestProgram } from './parse/TestProgramParser'
import { getContentFromFilesystem } from './parse/ProfileParser'
import { logToChannel } from './ABLUnitCommon'

export type ABLTestData = ABLTestDir | ABLTestFile | ABLTestCase
export type TestFile = ABLTestSuite | ABLTestClass | ABLTestProgram

class TestData {
	private td: WeakMap<TestItem, ABLTestData> = new WeakMap<TestItem, ABLTestData>()

	get(item: TestItem) {
		// console.log("testData.get: " + item.id + " " + this.td.get(item) + " " + this.td.get(item)?.description)
		return this.td.get(item)
	}

	set(item: TestItem, data: ABLTestData) {
		// console.log("testData.set: " + item.id + " " + data.description)
		this.td.set(item, data)
	}

	delete(item: TestItem) {
		// console.log("testData.delete: " + item.id)
		this.td.delete(item)
	}

	getMap() {
		return this.td
	}
}

export const testData = new TestData()

const displayClassLabel = workspace.getConfiguration('ablunit').get('display.classlabel','')

function createTestItem(controller: TestController,
						item: TestItem,
						range: Range | undefined,
						label: string,
						tag: string,
						description?: string) {
	const thead = controller.createTestItem(item.uri!.fsPath, label, item.uri)
	thead.description = description
	thead.range = range
	thead.tags = [new TestTag("runnable"), new TestTag(tag)]
	return thead
}

interface ITestType {
	isFile: boolean
	didResolve: boolean
	runnable: boolean
	canResolveChildren: boolean
	description: string
}

class TestTypeObj implements ITestType {
	public isFile = false
	public didResolve = false
	public runnable = false
	public canResolveChildren = false
	public description: string
	public label: string

	constructor (description: string, label: string) {
		this.description = description
		this.label = label
	}
}

export class ABLTestDir implements ITestType {
	public isFile = false
	public didResolve = true
	public runnable = true
	public canResolveChildren = false
	public description: string
	public relativePath: string

	constructor (path: Uri | string) {
		this.description = "ABLTestDir"
		if (path instanceof Uri) {
			this.relativePath = workspace.asRelativePath(path.fsPath, false)
		} else {
			this.relativePath = path
		}
	}
}

export class ABLTestCase extends TestTypeObj {
	constructor (public readonly id: string,
				label: string,
				description: string) {
		super(description, label)
	}
}

export class ABLTestFile extends TestTypeObj {
	public isFile: boolean = true
	public runnable: boolean = true
	public canResolveChildren: boolean = false
	public relativePath: string = ''
	currentResults?: ABLResults
	public children: ABLTestCase[] = []

	constructor (description: string, label: string) {
		super(description, label)
	}

	public async updateFromDisk(controller: TestController, item: TestItem) {
		try {
			const content = await getContentFromFilesystem(item.uri!)
			if(!content) {
				this.deleteItem(controller,item)
				return
			}
			item.error = undefined
			item.canResolveChildren = true
			this.updateFromContents(controller, content, item)
		} catch (e) {
			console.error("Error updating " + item.id + " from disk: " + e)
			item.error = (e as Error).stack
		}
	}

	updateFromContents(controller: TestController, content: string, item: TestItem) {
		throw new Error("Method not implemented - should be calling implementation in subclass")
	}

	startParsing(item: TestItem) {
		this.relativePath = workspace.asRelativePath(item.uri!.fsPath)
		logToChannel("parsing " + this.relativePath + " as " + this.description)
		this.didResolve = true
		item.tags = [new TestTag("runnable"), new TestTag(this.description)]
		item.description = this.description
	}

	deleteFromParent(controller: TestController, item: TestItem) {
		//Recursively delete from parent, if parent has no children, delete it too
		if (item.parent) {
			item.parent.children.delete(item.id)
			if (item.parent.children.size == 0) {
				this.deleteFromParent(controller, item.parent)
			}
		} else {
			controller.items.delete(item.id)
		}
	}

	updateItem(controller: TestController, item: TestItem, response: IClassRet | IProgramRet | undefined, childType: "Method" | "Procedure") {
		if (!response) {
			this.deleteItem(controller, item)
			return
		}
		item.label = response.label
		item.range = response.range
		this.updateChildren(controller, item, response.testcases, childType)
	}

	deleteItem(controller: TestController, item: TestItem) {
		testData.delete(item)
		this.deleteFromParent(controller, item)
		controller.items.delete(item.id)
	}

	updateChildren(controller: TestController, item: TestItem, testcases: ITestCase[], type: "Method" | "Procedure") {
		const originalChildren: string[] = []
		for (const [childId,] of item.children) {
			originalChildren.push(childId)
		}

		for (const tc of testcases) {
			const id = item.uri!.fsPath + "#" + tc.label
			const child = item.children.get(id)

			if (child) {
				originalChildren.splice(originalChildren.indexOf(id), 1)
				child.label = tc.label
				child.range = tc.range
			} else {
				this.createTestChild(controller, item, id, tc.range, tc.label, item.uri!, type)
			}
		}

		this.removeUnusedChildren(controller, item, originalChildren)
	}

	createTestChild(controller: TestController,
					item: TestItem,
					id: string,
					range: Range,
					label: string,
					uri: Uri,
					type: string) {
		const child = controller.createTestItem(id, label, uri)
		const data = new ABLTestCase(id, label, "ABL Test " + type)
		child.range = range
		child.tags = [new TestTag("runnable"), new TestTag("ABLTest" + type)]
		child.canResolveChildren = false
		child.description = "ABL Test " + type

		testData.set(child, data)
		this.children.push(data)
		item.children.add(child)
	}

	updateChild(item: TestItem, id: string, range: Range, label: string) {
		const child = item.children.get(id)
		if (child) {
			child.range = range
			child.label = label
			return true
		}
		return false
	}

	deleteChild(controller: TestController, item: TestItem, child: TestItem) {
		if (child) {
			item.children.delete(child.id)
			controller.items.delete(child.id)
			testData.delete(child)
		}
	}

	removeUnusedChildren(controller: TestController, item: TestItem, orphans: string[]) {
		// remove any children that no longer exist
		for (const childId of orphans) {
			const child = item.children.get(childId)
			if (child) {
				this.deleteChild(controller, item, child)
			}
		}
	}

}

export class ABLTestSuite extends ABLTestFile {

	constructor (label: string) {
		super("ABL Test Suite", label)
	}

	public updateFromContents(controller: TestController, content: string, item: TestItem) {
		this.startParsing(item)
		const response = parseABLTestSuite(content)

		if (!response) {
			this.deleteItem(controller,item)
			return
		}

		item.label = this.relativePath
		item.range = response.range
		item.canResolveChildren = true

		const originalChildren: string[] = []
		for (const [childId,] of item.children) {
			originalChildren.push(childId)
		}

		for (const cls of response.classes) {
			if(!cls) { continue }
			const id = item.uri!.fsPath + "#" + cls
			if(this.updateChildProgram(controller, item, response, id, cls, "ABLTestClass")) {
				originalChildren.splice(originalChildren.indexOf(id), 1)
			}
		}

		for (const proc of response.procedures) {
			if(!proc) { continue }
			const id = item.uri!.fsPath + "#" + proc
			if(this.updateChildProgram(controller, item, response, id, proc, "ABLTestProgram")) {
				originalChildren.splice(originalChildren.indexOf(id), 1)
			}
		}

		this.removeUnusedChildren(controller, item, originalChildren)
	}

	updateChildProgram(controller: TestController, item: TestItem, response: ITestSuite, id: string, label: string, type: "ABLTestClass" | "ABLTestProgram") {
		const child = item.children.get(id)

		if(child) {
			child.label = label
			child.range = response.range //TODO: this doesn't seem right
			return true
		} else {
			const thead = createTestItem(controller, item, undefined, label, label, type)
			if (type === "ABLTestClass") {
				const tData = new ABLTestClass(label)
				tData.setClassInfo(label)
				testData.set(thead, tData)
			} else {
				const tData = new ABLTestProgram(label)
				testData.set(thead, tData)
			}
			item.children.add(thead)
		}
		return false
	}
}

export class ABLTestClass extends ABLTestFile {
	public classTypeName: string = ''

	constructor(label: string) {
		super("ABL Test Class", label)
	}

	setClassInfo(classTypeName?: string) {
		if(classTypeName) {
			this.classTypeName = classTypeName
		}
	}

	public updateFromContents(controller: TestController, content: string, item: TestItem) {
		this.startParsing(item)
		const response = parseABLTestClass(displayClassLabel, content, this.relativePath)
		this.updateItem(controller, item, response, "Method")

		this.setClassInfo(response?.classname)
	}
}

export class ABLTestProgram extends ABLTestFile {

	constructor(label: string) {
		super("ABL Test Program", label)
	}

	public updateFromContents(controller: TestController, content: string, item: TestItem) {
		this.startParsing(item)
		const response = parseABLTestProgram(content, this.relativePath)
		this.updateItem(controller, item, response, "Procedure")
	}
}
