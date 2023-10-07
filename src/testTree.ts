import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { parseABLUnit } from './parser';
import { parseABLCallStack } from './ablHelper';
import { ABLResultsParser, TestCase } from './parse/ablResultsParser';
import * as cp from "child_process";

const textDecoder = new TextDecoder('utf-8');

export type ABLUnitTestData = TestFile | ABLTestSuiteClass | ABLTestClassNamespace | ABLTestClass | ABLTestProgram | ABLTestMethod | ABLTestProcedure | ABLAssert

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
}

export class TestFile extends TestTypeObj{
	public testFileType = "TestFile";

	public async updateFromDisk(controller: vscode.TestController, item: vscode.TestItem) {
		try {
			const content = await getContentFromFilesystem(item.uri!);
			item.error = undefined;
			this.updateFromContents(controller, content, item);
			
			if  (item.children.size == 0) {
				controller.items.delete(item.id)
			}
		} catch (e) {
			item.error = (e as Error).stack;
		}
	}

	/**
	 * Parses the tests from the input text, and updates the tests contained
	 * by this file to be those from the text,
	 */
	public updateFromContents(controller: vscode.TestController, content: string, item: vscode.TestItem) {
		const ancestors = [{ item, children: [] as vscode.TestItem[] }];
		const thisGeneration = generationCounter++;
		this.didResolve = true;

		const ascend = (depth: number) => {
			while (ancestors.length > depth) {
				const finished = ancestors.pop()!;
				finished.item.children.replace(finished.children);
			}
		};

		parseABLUnit(content, vscode.workspace.asRelativePath(item.uri!.fsPath), {

			onTestSuite: (range, suiteName) => {
				this.testFileType = "ABLTestSuite"
				const parent = ancestors[ancestors.length - 1];
				const id = `${item.uri}/${suiteName}`;

				const thead = controller.createTestItem(id, suiteName, item.uri);
				thead.range = range;
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestSuite") ]
				testData.set(thead, new ABLTestSuiteClass(thisGeneration, suiteName));
				parent.children.push(thead);
				ancestors.push({ item: thead, children: [] });
			},

			onTestClassNamespace: (range, classpath, element) => {
				this.testFileType = "ABLTestClassNamespace"
				var parent = ancestors[ancestors.length - 1];

				const id = `${classpath}`;
				const thead = controller.createTestItem(id, classpath, item.uri);
				thead.range = range;
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClassNamespace") ]
				thead.label = element
				testData.set(thead, new ABLTestClassNamespace(thisGeneration, classpath, element));
				if (! (testData.get(parent.item) instanceof TestFile)) {
					parent.children.push(thead);
				}
				ancestors.push({ item: thead, children: [] });
			},

			onTestClass: (range: vscode.Range, classname: string, label: string) => {
				this.testFileType = "ABLTestClass"
				var parent = ancestors[ancestors.length - 1];
				var index = ancestors.length - 1
				while(testData.get(parent.item) instanceof ABLTestClass) {
					index--
					parent = ancestors[index]
				}

				const id = `${item.uri}/${classname}`;
				const thead = controller.createTestItem(id, classname, item.uri);
				thead.range = range;
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClass") ]
				thead.label = label
				testData.set(thead, new ABLTestClass(thisGeneration, classname, label));

				if (! (testData.get(parent.item) instanceof TestFile)) {
					parent.children.push(thead);
				}
				ancestors.push({ item: thead, children: [] });
			},

			onTestProgram: (range: vscode.Range, programname: string) => {
				this.testFileType = "ABLTestProgram"
				const parent = ancestors[ancestors.length - 1];
				const id = `${item.uri}/${programname}`;

				const thead = controller.createTestItem(id, programname, item.uri);
				thead.range = range;
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestProgram")]
				testData.set(thead, new ABLTestProgram(thisGeneration, programname));
				parent.children.push(thead);
				ancestors.push({ item: thead, children: [] });
			},

			onTestMethod: (range: vscode.Range, classname: string, methodname: string) => {
				console.log("onTestMethod: classname=" + classname + " methodname=" + methodname)
				this.testFileType = "ABLTestMethod"
				var parent = ancestors[ancestors.length - 1];
				var index = ancestors.length - 1
				while(testData.get(parent.item) instanceof ABLTestMethod) {
					index--
					parent = ancestors[index]
				}

				const id = `${item.uri}/${classname}/${methodname}`;
				const thead = controller.createTestItem(id, methodname, item.uri);
				thead.range = range;
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestMethod") ]
				testData.set(thead, new ABLTestMethod(thisGeneration, classname, methodname));
				parent.children.push(thead);
				ancestors.push({ item: thead, children: [] });
			},

			onTestProcedure: (range: vscode.Range, programName: string, procedureName: string) => {
				this.testFileType = "ABLTestProcedure"
				var parent = ancestors[ancestors.length - 1];
				var index = ancestors.length - 1
				while(testData.get(parent.item) instanceof ABLTestProcedure) {
					index--
					parent = ancestors[index]
				}

				const id = `${item.uri}/${programName}/${procedureName}`;
				const thead = controller.createTestItem(id, procedureName, item.uri);
				thead.range = range;
				// thead.tags = [ new vscode.TestTag("runnable") ]
				thead.tags = [ new vscode.TestTag("ABLTestProcedure") ]
				testData.set(thead, new ABLTestProcedure(thisGeneration, programName, procedureName));
				parent.children.push(thead);
				ancestors.push({ item: thead, children: [] });
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

		ascend(0); // finish and assign children for all remaining items
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		// console.log("TestFile.run()")

		const start = Date.now();

		let itemPath = vscode.workspace.asRelativePath(item.uri!.fsPath);
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
		const resultsClass = new ABLResultsParser(workspaceDir + '/' + resultsPath)
		const results = resultsClass.resultsJson

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


export class ABLTestClass extends TestTypeObj {
	methods: ABLTestMethod[] = []
	
	constructor(
		public generation: number,
		private readonly classname: string,
		private readonly classlabel: string
	) { super () }

	addMethod(method: ABLTestMethod) {
		this.methods[this.methods.length] = method
	}

	getLabel() {
		return this.classlabel
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		// console.log("ABLTestClass.run() TODO")
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
		const resultsClass = new ABLResultsParser(workspaceDir + '/' + resultsPath)
		const results = resultsClass.resultsJson

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

export class ABLTestProgram extends TestTypeObj {
	procedures: ABLTestProcedure[] = []

	constructor(
		public generation: number,
		private readonly className: string
	) { super () }

	addMethod(method: ABLTestProcedure) {
		this.procedures[this.procedures.length] = method
	}

	getLabel() {
		return this.className
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		const start = Date.now();

		let itemPath = vscode.workspace.asRelativePath(item.uri!.fsPath);
		const workspaceDir = vscode.workspace.workspaceFolders?.map(item => item.uri.fsPath);

		var cmd = vscode.workspace.getConfiguration('ablunit').get('runTestCommand', '').trim();
		if (! cmd) {
			cmd = '_progres -b -p ABLUnitCore.p -basekey INI -ininame progress.ini -param "${itemPath} CFG=ablunit.json"';
		}
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

		const fs = require('fs');
		var parseString = require('xml2js').parseString;
		
		const resultsPath = vscode.workspace.getConfiguration('ablunit').get('resultsPath', '').trim();
		const xmlData = fs.readFileSync(workspaceDir + "/" + resultsPath, "utf8");
		parseString(xmlData, function (err: any, result: any) {
			if (err) {
				options.errored(item, new vscode.TestMessage(err), duration);
				return console.error(err);
			}
			fs.writeFile(workspaceDir + "/" + resultsPath.replace(/\.xml$/,".json"), JSON.stringify(result, null, 2), function(err: any) {
				if (err) {
					console.log(err);
				}
			});

			var testSuite
			for (let key in result['testsuites']['testsuite']) {
				if(JSON.stringify(result['testsuites']['testsuite'][key]['$']['name']).endsWith(itemPath + '"')) {
					testSuite=result['testsuites']['testsuite'][key]
				}
			}

			if(! testSuite){
				options.skipped(item)
				return;
			}
			
			var testCase
			for(let key in testSuite['testcase']){
				if (testSuite['testcase'][key]['$']['name'] == item.label){
					testCase = testSuite['testcase'][key];
				}
			}
			
			switch (testCase['$']['status']) {
				case "Success":
					if (testCase['$']['ignored']) {
						options.skipped(item);
					} else {
						options.passed(item, duration);
					}
					return;
				case "Failure":
					const failMessage = testCase['failure']['0']['$']['message'];
					const expected = failMessage.replace('Expected: ','').replace(/ but was: .*$/,'');
					const got = failMessage.replace(/^.* but was: /,'');

					const stackStringFail = parseABLCallStack(testCase['failure'][0]['_'].replaceAll(workspaceDir + "\\",""));
					const mdStack = new vscode.MarkdownString("# Assert Failure\n\n" + failMessage + "\n\n# Call Stack\n\n" + stackStringFail);
					
					const message1 = vscode.TestMessage.diff(failMessage, String(expected), String(got));
					const message2 = new vscode.TestMessage(mdStack);
					options.failed(item, [message1, message2], duration);
					return;
				case "Error":
					const errMessage = testCase['error'][0]['$']['message']
					const stackStringErr = testCase['error']['0']['_'].replaceAll(workspaceDir + "\\","")
 					options.errored(item, [new vscode.TestMessage(errMessage), new vscode.TestMessage(stackStringErr)], duration);
					return;
				default:
					throw('test case result not found!');
			}
			
		});
	}
}

export class ABLTestMethod extends TestTypeObj { // child of TestClass
	constructor(
		public generation: number,
		private readonly className: string,
		private readonly methodName: string
	) { super () }

	getLabel() {
		return this.methodName
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		// console.log("ABLTestClass.run() TODO")
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
		const resultsClass = new ABLResultsParser(workspaceDir + '/' + resultsPath)
		const results = resultsClass.resultsJson

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

	constructor(
		public generation: number,
		private readonly programName: string,
		private readonly procedureName: string
	) { super() }

	getLabel() {
		return this.procedureName
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
