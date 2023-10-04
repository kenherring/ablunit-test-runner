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
		// if(item.label.startsWith("testMethod") || item.label.startsWith("testProc")) {
		// 	itemPath = itemPath + "#" + item.label; 
		// }
		const workspaceDir = vscode.workspace.workspaceFolders?.map(item => item.uri.fsPath);

		var cmd = vscode.workspace.getConfiguration('ablunit').get('runTestCommand', '').trim();
		console.log("ablunitCommand=" + cmd);
		if (! cmd) {
			cmd = '_progres -b -p ABLUnitCore.p -basekey INI -ininame progress.ini -param "${itemPath} CFG=ablunit.json" -profile profile.config';
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
				// console.log(stdout);
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
			if (err) {
				options.errored(item, new vscode.TestMessage(err), duration);
				return console.error(err);
			}
			fs.writeFile(workspaceDir + "/" + resultsPath.replace(/\.xml$/,".json"), JSON.stringify(result, null, 2), function(err: any) {
				if (err) {
					console.log(err);
				}
			});

			// const errorCount: any[] = result['testsuites']['$']['errors'];
			// const failureCount: any[] = result['testsuites']['$']['failures'];
			// const testCount: any[] = result['testsuites']['$']['tests'];
			// console.log(errorCount + " " + failureCount + " " + testCount);
			
			var testSuite
			for (let key in result['testsuites']['testsuite']) {
				if(JSON.stringify(result['testsuites']['testsuite'][key]['$']['name']).endsWith(itemPath + '"')) {
					testSuite=result['testsuites']['testsuite'][key]
				}
			}
			
			var testCase
			for(let key in testSuite['testcase']){
				if (testSuite['testcase'][key]['$']['name'] == item.label){
					testCase = testSuite['testcase'][key];
				}
			}
			console.log("status=" + testCase['$']['status'])
			
			const re = new RegExp(`${workspaceDir}`, 'g')

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
					const errMessage = testCase['error'][0]['$']['message'].replace(re,'');
					const stackStringErr = testCase['error']['0']['_'].replaceAll(workspaceDir + "\\","")
 					options.errored(item, [new vscode.TestMessage(errMessage), new vscode.TestMessage(stackStringErr)], duration);
					return;
				default:
					throw('test case result not found!');
			}
			
		});
	}
}
