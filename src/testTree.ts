import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { parseABLUnit } from './parser';
import { parseABLCallStack } from './ablHelper';
import { ABLResultsParser, TestCase } from './parse/ablResultsParser';
import * as cp from "child_process";

const textDecoder = new TextDecoder('utf-8');

export type ABLUnitTestData = ABLTestSuiteClass | ABLTestClassNamespace | ABLTestClass | ABLTestProgram | ABLTestMethod | ABLTestProcedure | ABLAssert

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
	
	getLabel() {
		return this.label
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
			console.log("updateFromDisk item.children.size=" + item.children.size + " " + item.id + " " + item.label + " " + item.parent?.id + " " + item.parent?.label)

			var topNode = item;
			while(topNode.parent) {
				topNode = topNode.parent
			}
			// console.log("controller.items.add=" + topNode.id + " " + topNode.label)
			// controller.items.add(topNode)
			if(this.replaceWith != undefined) {
				const currItem = controller.items.get(this.replaceWith.id)
				if (currItem) {
					console.log("currItem id=" + currItem.id + " " + currItem.label)
					this.replaceWith.children.forEach(element => {
						currItem.children.add(element)
					});
				} else {
					console.log("controller.items.add=" + this.replaceWith.id + " " + this.replaceWith.label)
					controller.items.add(this.replaceWith)
				}
				controller.items.delete(item.id)
			} else {
				console.log("replaceWith = undefined")
			}

			
			
			
			// if  (item.children.size == 0) {
			// 	console.log("TestFile controller.items.delete=" + item.id + " " + item.label)
			// 	controller.items.delete(item.id)
			// }
		} catch (e) {
			item.error = (e as Error).stack;
		}
	}

	/**
	 * Parses the tests from the input text, and updates the tests contained
	 * by this file to be those from the text,
	 */
	public updateFromContents(controller: vscode.TestController, content: string, item: vscode.TestItem) {
		console.log("updateFromContents TestFile - skipping")
	}
	
	public updateFromContents2(controller: vscode.TestController, content: string, item: vscode.TestItem) { 
		const ancestors = [{ item, children: [] as vscode.TestItem[] }];
		const thisGeneration = generationCounter++;
		this.didResolve = true;

		const ascend = (depth: number) => {
			console.log("ascend depth=" + depth)

			for(let idx=1; idx<ancestors.length; idx++) {
				console.log("ancestor-label-" + idx + "=" + ancestors[idx].item.label + " " + JSON.stringify(ancestors[idx].item.tags))
			}

			while (ancestors.length > depth) {
				const finished = ancestors.pop()!;
				console.log("finished.item.label=" + finished.item.label)
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
				ancestors.unshift({ item: thead, children: [] });
			},

			onTestClassNamespace: (range, classpath, element) => {
				this.testFileType = "ABLTestClassNamespace"
				console.log("onTestClassNamespace classpath=" + classpath + " element=" + element)
				var parent = ancestors[ancestors.length - 1];
				console.log("parent=" + parent.item.label)

				const id = `${classpath}`;
				const thead = controller.createTestItem(id, classpath, item.uri);
				thead.range = range;
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClassNamespace") ]
				thead.label = element
				thead.children.add(item)
				testData.set(thead, new ABLTestClassNamespace(thisGeneration, classpath, element));
				ancestors.unshift({ item: thead, children: [] });
			},

			onTestClass: (range: vscode.Range, classname: string, label: string) => {
				this.testFileType = "ABLTestClass"
				console.log("onTestClass classname=" + classname + " label=" + label)
				var parent = ancestors[ancestors.length - 1];
				console.log("parent=" + parent)

				item.range = range
				item.label = label
				item.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClass") ]
				
				
				console.log()
				
				// testData.set(thead, new ABLTestClass(thisGeneration, classname, label));

				// if (! (testData.get(parent.item) instanceof TestFile)) {
					// parent.children.push(thead);
				// }
				// ancestors.push({ item: thead, children: [] });
			},

			onTestProgram: (range: vscode.Range, programname: string) => {
				this.testFileType = "ABLTestProgram"

				var self = ancestors[ancestors.length - 1];
				self.item.range = range
				self.item.label = programname
				self.item.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestProgram") ]

				// const parent = ancestors[ancestors.length - 1];
				// const id = `${item.uri}/${programname}`;

				// const thead = controller.createTestItem(id, programname, item.uri);
				// thead.range = range;
				// thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestProgram")]
				// testData.set(thead, new ABLTestProgram(thisGeneration, programname));
				// parent.children.push(thead);
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

export class ABLTestClass extends TestFile {
	methods: ABLTestMethod[] = []
	
	setClassInfo(classname: string, classlabel: string) {
		this.name = classname
		this.label = classlabel
	}

	addMethod(method: ABLTestMethod) {
		this.methods[this.methods.length] = method
	}

	public updateFromContents(controller: vscode.TestController, content: string, item: vscode.TestItem) {
		console.log("updateFromContents ABLTestClass")
		const ancestors = [{ item, children: [] as vscode.TestItem[] }];
		ancestors.pop()
		const thisGeneration = generationCounter++;
		this.didResolve = true;

		const ascend = (depth: number) => {
			console.log("ascend depth=" + depth)

			for(let idx=0; idx<ancestors.length; idx++) {
				console.log("1: ancestor-label-" + idx + "=" + ancestors[idx].item.label + " " + JSON.stringify(ancestors[idx].item.tags) + " parent=" +  ancestors[idx].item.parent?.label)
			}

			while (ancestors.length > depth) {
				const finished = ancestors.pop()!;
				console.log("finished.item.label=" + finished.item.label + " " + finished.item.children.size + " " + finished.children.length)
				finished.item.children.replace(finished.children);
				console.log("finished.item=" + finished.item.id + " " + finished.item.children.size + " " + finished.item.parent?.id + " " + finished.item.parent?.label)
				this.replaceWith = finished.item
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
				ancestors.unshift({ item: thead, children: [] });
			},

			onTestClassNamespace: (range: vscode.Range, classpath: string, element: string, classpathUri: vscode.Uri) => {
				this.testFileType = "ABLTestClassNamespace2"
				console.log("onTestClassNamespace classpath=" + classpath + " element=" + element + " classpathUri=" + classpathUri.toString())
				if (ancestors.length > 0) {
					var parent = ancestors[ancestors.length - 1];
					console.log("parent=" + parent.item.label)
				}

				const id = `${classpath}`;
				console.log("id=" + id + " classpath=" + classpath + " element=" + element + " uri=" + item.uri?.toString().lastIndexOf(element))
				const thead = controller.createTestItem(id, classpath, item.uri);
				thead.range = range;
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClassNamespace") ]
				thead.label = element
				if (ancestors.length > 0) {
					var parent = ancestors[ancestors.length - 1];
					console.log("add " + thead.label + " as child to " + parent.item.label)
					parent.children.push(thead)
					// parent.item.children.add(item)
				}
				testData.set(thead, new ABLTestClassNamespace(thisGeneration, classpath, element));
				console.log("ancestors.push")
				ancestors.push({ item: thead, children: [] as vscode.TestItem[] });
				console.log("ancestors=" + ancestors)
			},

			onTestClass: (range: vscode.Range, classname: string, label: string) => {
				this.testFileType = "ABLTestClass"
				console.log("onTestClass classname=" + classname + " label=" + label + " item.uri=" + item.uri?.toString())
				var parent = ancestors[ancestors.length - 1];
				console.log("parent=" + parent.item.label)

				const id = `${classname}`;
				const thead = controller.createTestItem(id, classname, item.uri)
				thead.range = range
				thead.label = label
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestClass") ]
				var tData = new ABLTestClass()
				tData.setClassInfo(classname, label)
				testData.set(thead, tData)
				console.log("parent.add=" + parent.item.label + " " + thead.label)
				parent.children.push(thead)
				// parent.item.children.add(item)
				console.log("ancestors.push")
				ancestors.push({ item: thead, children: [] as vscode.TestItem[] });
				console.log("ancestors=" + ancestors)
				console.log("myparent=" + thead.parent?.id + " " + thead.parent?.label)
				
				
				// testData.set(thead, new ABLTestClass(thisGeneration, classname, label));

				// if (! (testData.get(parent.item) instanceof TestFile)) {
					// parent.children.push(thead);
				// }
				// ancestors.push({ item: thead, children: [] });
			},

			onTestProgram: (range: vscode.Range, programname: string) => { console.error("should not be here! programname=" + programname) },

			onTestMethod: (range: vscode.Range, classname: string, methodname: string) => {
				console.log("onTestMethod: classname=" + classname + " methodname=" + methodname)
				this.testFileType = "ABLTestMethod"
				var parent = ancestors[ancestors.length - 1];
				console.log("parent=" + parent.item.label)
				// var index = ancestors.length - 1
				// while(testData.get(parent.item) instanceof ABLTestMethod) {
				// 	index--
				// 	parent = ancestors[index]
				// }

				const id = `${item.uri}/${classname}/${methodname}`;
				const thead = controller.createTestItem(id, methodname, item.uri);
				thead.range = range;
				thead.tags = [ new vscode.TestTag("runnable"), new vscode.TestTag("ABLTestMethod") ]
				thead.label = methodname
				testData.set(thead, new ABLTestMethod(thisGeneration, classname, methodname));
				parent.children.push(thead);
				// ancestors.push({ item: thead, children: [] });
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

		ascend(0); // finish and assign children for all remaining items
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

export class ABLTestProgram extends TestFile {
	procedures: ABLTestProcedure[] = []
	
	setProgramInfo(programname: string, programlabel: string) {
		this.name = programname
		this.label = programlabel
	}

	addMethod(method: ABLTestProcedure) {
		this.procedures[this.procedures.length] = method
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

	constructor(public generation: number,
				private readonly classname: string,
				private readonly methodName: string ) { 
		super ()
		this.name = methodName
		this.label = methodName 
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
