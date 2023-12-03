import { Range, TestController, TestItem, TestTag, Uri, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { parseABLTestSuite } from './parse/TestSuiteParser'
import { parseABLTestClass } from './parse/TestClassParser'
import { parseABLTestProgram } from './parse/TestProgramParser'
import { getContentFromFilesystem } from './parse/ProfileParser'
import { logToChannel } from './ABLUnitCommon'

export type ABLUnitTestData = ABLTestDir | ABLTestFile | ABLRunnable | ABLAssert
export type ABLRunnable = ABLTestSuite | ABLTestClass | ABLTestProgram | ABLTestMethod | ABLTestProcedure
export type TestFile = ABLTestSuite | ABLTestClass | ABLTestProgram


export const testData = new WeakMap<TestItem, ABLUnitTestData>()
const displayClassLabel = workspace.getConfiguration('ablunit').get('display.classLabel','')

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
						uri: Uri,
						description: string) {
	const child = controller.createTestItem(relativePath + '#' + procedureName, procedureName, uri)
	child.range = range
	child.label = procedureName
	child.tags = [new TestTag("runnable"), new TestTag("ABLTestProcedure")]
	child.canResolveChildren = false
	child.description = "ABL Test " + description
	return child
}

interface ITestType {
	isFile: boolean
	didResolve: boolean
	runnable: boolean
	canResolveChildren: boolean
}

class TestTypeObj implements ITestType {
	public isFile = false
	public didResolve = false
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
			if(!content) {
				this.deleteItem(controller,item)
				return
			}
			item.error = undefined
			this.updateFromContents(controller, content, item)
		} catch (e) {
			item.error = (e as Error).stack
		}
	}

	updateFromContents(controller: TestController, content: string, item: TestItem) {
		throw new Error("Method not implemented - should be calling implementation in subclass")
	}

	startParsing(item: TestItem, tag: string) {
		this.relativePath = workspace.asRelativePath(item.uri!.fsPath)
		logToChannel("parsing " + this.relativePath)
		this.didResolve = true
		item.tags = [new TestTag("runnable"), new TestTag(tag)]
		item.description = tag
		item.canResolveChildren = false
		item.children.replace([])
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

	deleteItem(controller: TestController, item: TestItem) {
		testData.delete(item)
		this.deleteFromParent(controller, item)
		controller.items.delete(item.id)
	}
}

export class ABLTestSuite extends ABLTestFile {

	public updateFromContents(controller: TestController, content: string, item: TestItem) {
		this.startParsing(item, "ABL Test Suite")
		const response = parseABLTestSuite(content)

		if (!response) {
			this.deleteItem(controller,item)
			return
		}

		item.label = this.relativePath
		item.range = response.range

		for (const classpath of response.classes) {
			const thead = createTestItem(controller, item, undefined, classpath, classpath, "ABLTestClass")
			const tData = new ABLTestClass()
			tData.setClassInfo(classpath, classpath)
			testData.set(thead, tData)
			item.children.add(thead)
		}

		for (const procedure of response.procedures) {
			const thead = createTestItem(controller, item, undefined, procedure, procedure, "ABLTestClass")
			const tData = new ABLTestProgram()
			testData.set(thead, tData)
			item.children.add(thead)
		}
	}
}

export class ABLTestClass extends ABLTestFile {
	public canResolveChildren: boolean = true
	public classpath: string = ''
	public classlabel: string = ''
	methods: ABLTestMethod[] = []

	setClassInfo(classpath: string, classlabel: string) {
		this.classpath = classpath
		this.classlabel = classlabel
	}

	addMethod(method: ABLTestMethod) {
		this.methods[this.methods.length] = method
	}

	public updateFromContents(controller: TestController, content: string, item: TestItem) {
		this.startParsing(item, "ABL Test Class")
		const response = parseABLTestClass(workspace.getWorkspaceFolder(item.uri!)!, displayClassLabel, content, this.relativePath)

		if(!response) {
			this.deleteItem(controller,item)
			return
		}

		item.label = response.classname
		item.range = response.range

		for(const method of response.methods) {
			if(!method) { continue }
			const child = createTestChild(controller, method.range, method.methodname, response.classname, item.uri!, "Method")
			const methodObj = new ABLTestMethod(response.classname, response.classname, method.methodname)
			this.addMethod(methodObj)
			item.children.add(child)
		}
	}
}

export class ABLTestProgram extends ABLTestFile {
	public canResolveChildren: boolean = true
	procedures: ABLTestProcedure[] = []

	addChild(item: TestItem, proc: ABLTestProcedure) {
		this.procedures.push(proc)
		testData.set(item, new ABLTestProcedure(this.relativePath, proc.name))
	}

	public updateFromContents(controller: TestController, content: string, item: TestItem) {
		this.startParsing(item, "ABL Test Program")
		const response = parseABLTestProgram(content, this.relativePath)
		if(!response) {
			this.deleteItem(controller,item)
			return
		}

		item.label = response.label
		item.range = new Range(0,0,0,0)

		for(const procedure of response.procedures) {
			if(!procedure) { continue }
			const child = createTestChild(controller, procedure.range, procedure.procedureName, response.label, item.uri!, "Procedure")
			const proc = new ABLTestProcedure(response.label, procedure.procedureName)
			this.addChild(child, proc)
			item.children.add(child)
		}

	}
}

export class ABLTestMethod extends ABLTestCase { // child of TestClass
	public description = "ABL Test Method"
	public name: string
	constructor(private readonly relativePath: string, private readonly classname: string, private readonly methodName: string) {
		super()
		this.name = methodName
	}
}

export class ABLTestProcedure extends ABLTestCase { // child of TestProgram
	public description = "ABL Test Procedure"
	public name: string
	constructor(private readonly programname: string, private readonly procedureName: string) {
		super()
		this.name = procedureName
	}
}

export class ABLAssert extends TestTypeObj { // child of TestMethod or TestProcedure
	public canResolveChildren: boolean = false
	public runnable: boolean = false

	constructor(private readonly assertText: string) {
		super()
	}
}
