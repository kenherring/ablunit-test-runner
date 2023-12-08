import { Range, TestController, TestItem, TestTag, Uri, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { parseABLTestSuite } from './parse/TestSuiteParser'
import { parseABLTestClass } from './parse/TestClassParser'
import { parseABLTestProgram } from './parse/TestProgramParser'
import { getContentFromFilesystem } from './parse/ProfileParser'
import { logToChannel } from './ABLUnitCommon'

export type ABLUnitTestData = ABLTestDir | ABLTestFile | ABLRunnable | ABLAssert
export type ABLRunnable = ABLTestFile | ABLTestSuite | ABLTestClass | ABLTestProgram | ABLTestMethod | ABLTestProcedure
export type TestFile = ABLTestSuite | ABLTestClass | ABLTestProgram


export const testData = new WeakMap<TestItem, ABLUnitTestData>()
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

function createTestChild(controller: TestController,
						range: Range,
						procedureName: string,
						relativePath: string,
						uri: Uri,
						description: string,
						data: ABLTestProcedure | ABLTestMethod) {
	const child = controller.createTestItem(uri.fsPath + '#' + procedureName, procedureName, uri)
	child.range = range
	child.label = procedureName
	child.tags = [new TestTag("runnable"), new TestTag("ABLTestProcedure")]
	child.canResolveChildren = false
	child.description = "ABL Test " + description
	testData.set(child, data)
	return child
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

	constructor () {
		this.description = "TestTypeObj"
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
	public testCaseType = "TestCase"
	public runnable = true
	public canResolveChildren = true

	constructor () {
		super()
		this.description = "ABLTestCase"
	}
}

export class ABLTestFile extends TestTypeObj {
	public isFile: boolean = true
	public runnable: boolean = true
	public canResolveChildren: boolean = false
	public relativePath: string = ''
	currentResults?: ABLResults

	constructor () {
		super()
		this.description = "ABLTestFile"
	}

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

	constructor() {
		super()
		this.description = "ABL Test Suite"
	}

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

	constructor() {
		super()
		this.description = "ABL Test Class"
	}

	setClassInfo(classpath: string, classlabel: string) {
		this.classpath = classpath
		this.classlabel = classlabel
	}

	addMethod(method: ABLTestMethod) {
		this.methods[this.methods.length] = method
	}

	public updateFromContents(controller: TestController, content: string, item: TestItem) {
		this.startParsing(item, "ABL Test Class")
		const response = parseABLTestClass(displayClassLabel, content, this.relativePath)

		if(!response) {
			this.deleteItem(controller,item)
			return
		}

		item.label = response.label
		item.range = response.range

		for(const method of response.methods) {
			if(!method) { continue }
			const data = new ABLTestMethod(this.relativePath, response.classname, method.methodname)
			const child = createTestChild(controller, method.range, method.methodname,this.relativePath, item.uri!, "Method", data)
			const methodObj = new ABLTestMethod(this.relativePath, response.classname, method.methodname)
			this.addMethod(methodObj)
			item.children.add(child)
		}
	}
}

export class ABLTestProgram extends ABLTestFile {
	public canResolveChildren: boolean = true
	procedures: ABLTestProcedure[] = []

	constructor() {
		super()
		this.description = "ABL Test Program"
	}

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
			const data = new ABLTestProcedure(response.label, procedure.procedureName)
			const child = createTestChild(controller, procedure.range, procedure.procedureName, response.label, item.uri!, "Procedure", data)
			const proc = new ABLTestProcedure(response.label, procedure.procedureName)
			this.addChild(child, proc)
			item.children.add(child)
		}

	}
}

export class ABLTestMethod extends ABLTestCase { // child of TestClass
	public name: string
	constructor(private readonly relativePath: string, private readonly classname: string, private readonly methodName: string) {
		super()
		this.name = methodName
		this.description = "ABL Test Method"
	}
}

export class ABLTestProcedure extends ABLTestCase { // child of TestProgram
	public name: string
	constructor(private readonly programname: string, private readonly procedureName: string) {
		super()
		this.name = procedureName
		this.description = "ABL Test Procedure"
	}
}

export class ABLAssert extends TestTypeObj { // child of TestMethod or TestProcedure
	public name: string
	constructor(private readonly assertText: string) {
		super()
		this.name = assertText
		this.description = "ABL Assert"
		this.canResolveChildren = false
		this.runnable = false
	}
}
