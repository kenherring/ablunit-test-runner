import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { parseABLUnit } from './parser';
import { parseABLCallStack } from './ablHelper';
import * as cp from "child_process";

const textDecoder = new TextDecoder('utf-8');

export type ABLUnitTestData = TestFile | TestHeading | TestCase;

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

export class TestFile {
	public didResolve = false;

	public async updateFromDisk(controller: vscode.TestController, item: vscode.TestItem) {
		try {
			const content = await getContentFromFilesystem(item.uri!);
			item.error = undefined;
			this.updateFromContents(controller, content, item);
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

		parseABLUnit(content, {
			onTest: (range, methodName) => {
				const parent = ancestors[ancestors.length - 1];
				const data = new TestCase(methodName, thisGeneration);
				const id = `${item.uri}#${data.getLabel()}`;

				// TODO tag as method?
				const tcase = controller.createTestItem(id, data.getLabel(), item.uri);
				testData.set(tcase, data);
				tcase.range = range;
				parent.children.push(tcase);
			},

			onHeading: (range, className) => {
				const parent = ancestors[ancestors.length - 1];
				const id = `${item.uri}/${className}`;

				const thead = controller.createTestItem(id, className, item.uri);
				thead.range = range;
				testData.set(thead, new TestHeading(thisGeneration));
				parent.children.push(thead);
				ancestors.push({ item: thead, children: [] });
			},
		});

		ascend(0); // finish and assign children for all remaining items
	}
}

export class TestHeading {
	constructor(public generation: number) { }
}

export class TestCase {
	constructor(
    private readonly methodName: string,
		public generation: number
	) { }

	getLabel() {
		return `${this.methodName}`;
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		const start = Date.now();

		let itemPath = vscode.workspace.asRelativePath(item.uri!.fsPath);
		console.log("itemPath=" + itemPath);
		if(item.label.startsWith("testMethod") || item.label.startsWith("testProc")) {
			itemPath = itemPath + "#" + item.label; 
		}
		const workspaceDir = vscode.workspace.workspaceFolders?.map(item => item.uri.fsPath);

		var cmd = vscode.workspace.getConfiguration('ablunit').get('runTestCommand', '').trim();
		console.log("ablunitCommand=" + cmd);4
		if (! cmd) {
			cmd = '_progres -b -p ABLUnitCore.p -basekey INI -ininame progress.ini -param "${itemPath} CFG=ablunit.json"';
		}


		cmd = cmd.replace("${itemPath}",itemPath);
		
		console.log("cmd=" + cmd);
		await new Promise<string>((resolve, reject) => {
			cp.exec(cmd, { cwd: workspaceDir?.toString() }, (err, stdout, stderr) => {
				if (err) {
					console.log(cmd+' error!');
					console.log(err);
					options.appendOutput(stderr);
					// reject(err);
				}
				console.log(stdout);
				options.appendOutput(stdout);
				return resolve(stdout);
			});
		});
		const duration = Date.now() - start;

		const fs = require('fs');
		var parseString = require('xml2js').parseString;
		
		const resultsPath = vscode.workspace.getConfiguration('ablunit').get('resultsPath', '').trim();
		console.log("resultsPath=" + resultsPath);
		const xmlData = fs.readFileSync(workspaceDir + "/" + resultsPath, "utf8");
		// const jsonData = parseString(xmlData);
		parseString(xmlData, function (err: any, result: any) {
			console.log("err=" + err + " result=" + result);

			if (err) {
				options.errored(item, new vscode.TestMessage(err), duration);
				return console.error(err);
			}
			console.log("write json to file: " + resultsPath.replace(/\.xml$/,".json"));
			fs.writeFile(workspaceDir + "/" + resultsPath.replace(/\.xml$/,".json"), JSON.stringify(result, null, 2), function(err: any) {
				if (err) {
					console.log(err);
				}
			});

			const errorCount: any[] = result['testsuites']['$']['errors'];
			const failureCount: any[] = result['testsuites']['$']['failures'];
			const testCount: any[] = result['testsuites']['$']['tests'];
			console.log(errorCount + " " + failureCount + " " + testCount);
			
			var testSuite
			console.log(result['testsuites']['testsuite'].length)
			for (let key in result['testsuites']['testsuite']) {
				console.log("key=" + JSON.stringify(key));
				console.log("testsuite_path=" + result['testsuites']['testsuite'][key]['$']['name']);
				console.log(JSON.stringify(result['testsuites']['testsuite'][key]['$']['name']));
				console.log("itemPath=      " + itemPath);
				if(JSON.stringify(result['testsuites']['testsuite'][key]['$']['name']).endsWith(itemPath + '"')) {
					console.log('found');
					testSuite=result['testsuites']['testsuite'][key]
				}
				console.log("END");
				// if (key['$']['name'] == itemPath) {
				// 	console.log("SUCCESS!");
				// }
			}
			
			var testCase
			for(let key in testSuite['testcase']){
				console.log("key2=" + JSON.stringify(key))
				console.log("name=" + testSuite['testcase'][key]['$']['name'])
				if (testSuite['testcase'][key]['$']['name'] == item.label){
					testCase = testSuite['testcase'][key];
				}
			}
			console.log("status=" + testCase['$']['status'])

			switch (testCase['$']['status']) {
				case "Success":
					options.passed(item, duration);
					return;
				case "Failure":
					const failMessage = testCase['failure']['0']['$']['message'];
					console.log("failMessage='" + failMessage + "'");
					const expected = failMessage.replace('Expected: ','').replace(/ but was: .*$/,'');
					const got = failMessage.replace(/^.* but was: /,'');
					console.log("expected='" + expected + "', got='" + got + "'");
					
					
					const callStack = parseABLCallStack(testCase['failure'][0]['_']);
					console.log("callStack[0]['method']='" + callStack[0]['method'] + "'");

					//.replace(/\\r/g,'\n')
					console.log("workspaceDir=" + workspaceDir)
					const re = new RegExp(`${workspaceDir}`, 'g')
					const stackString = testCase['failure'][0]['_'].replace(/\\n/g,'\n\n').replace(/\)/g,")\n\n").replace(re,'');
					const mdStack = new vscode.MarkdownString("# Assert Failure\n\n" + failMessage + "\n\n# Call Stack\n\n" + stackString);
					
					const message1 = vscode.TestMessage.diff(failMessage, String(expected), String(got));
					const message2 = new vscode.TestMessage(mdStack);
					message1.location = callStack.firstLocation;
					options.failed(item, [message1, message2], duration);
					return;
				case "Error":
					const errMessage = result['testsuites']['testsuite']['0']['testcase']['0']['error']['0']['$']['message'] + '\n\n' +
					result['testsuites']['testsuite']['0']['testcase']['0']['error']['0']['_'];
 					options.errored(item, new vscode.TestMessage(errMessage), duration);
				default:
					options.skipped(item);
					break;
			}
			

			// if(errorCount[0] > 0) {
			// 	const errMessage = result['testsuites']['testsuite']['0']['testcase']['0']['error']['0']['$']['message'] + '\n\n' +
			// 					   result['testsuites']['testsuite']['0']['testcase']['0']['error']['0']['_'];
			// 	options.errored(item, new vscode.TestMessage(errMessage), duration);
			// } else if(failureCount[0] > 0) {
			// 	// console.log("result4=" + JSON.stringify(result['testsuites']['testsuite']['0']['testcase']['0']['failure']['0']['$']['message']));
				
			// 	const failMessage = result['testsuites']['testsuite']['0']['testcase']['0']['failure']['0']['$']['message'];
			// 	const expected = failMessage.replace('Expected: ','').replace(/ but was: .*$/,'');
			// 	const got = failMessage.replace(/^.* but was: /,'');
			// 	const message = vscode.TestMessage.diff(`Expected ${item.label}`, String(expected), String(got));
			// 	options.failed(item, message, duration);
			// } else if(testCount[0] > 0)
			// 	options.passed(item, duration);
			// else
			// 	options.skipped(item);
		});
	}

}
