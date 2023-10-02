import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { parseABLUnit } from './parser';
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

		let itemPath = vscode.workspace.asRelativePath(item.uri!.fsPath).replace('src/test/','');
		if(item.label.startsWith('testMethod'))
			itemPath = itemPath + '#' + item.label; 
		const workspaceDir = vscode.workspace.workspaceFolders?.map(item => item.uri.fsPath);

		const cmd = '_progres -b -p ABLUnitCore.p -basekey INI -ininame progress.ini -param "' + itemPath + ' CFG=ablunit.json"';
		console.log("cmd=" + cmd);
		await new Promise<string>((resolve, reject) => {
			cp.exec(cmd, { cwd: workspaceDir?.toString() }, (err, stdout, stderr) => {
				if (err) {
					console.log(cmd+' error!');
					options.appendOutput(stderr);
					reject(err);
				}
				console.log(stdout);
				options.appendOutput(stdout);
				return resolve(stdout);
			});
		});
		const duration = Date.now() - start;

		const fs = require('fs');
		var parseString = require('xml2js').parseString;
		const xmlData = fs.readFileSync(workspaceDir + '/results.xml', "utf8");
		// const jsonData = parseString(xmlData);
		parseString(xmlData, function (err: any, result: any) {
			console.log("err=" + err + " result=" + result);

			if (err) {
				options.errored(item, new vscode.TestMessage(err), duration);
				return console.error(err);
			}
			console.log("write json to file");
			fs.writeFile(workspaceDir + "/results.json", JSON.stringify(result, null, 2), function(err: any) {
				if (err) {
					console.log(err);
				}
			});

			const errorCount: any[] = result['testsuites']['$']['errors'];
			const failureCount: any[] = result['testsuites']['$']['failures'];
			const testCount: any[] = result['testsuites']['$']['tests'];
			console.log(errorCount + " " + failureCount + " " + testCount);
			

			if(errorCount[0] > 0) {
				const errMessage = result['testsuites']['testsuite']['0']['testcase']['0']['error']['0']['$']['message'] + '\n\n' +
								   result['testsuites']['testsuite']['0']['testcase']['0']['error']['0']['_'];
				options.errored(item, new vscode.TestMessage(errMessage), duration);
			} else if(failureCount[0] > 0) {
				// console.log("result4=" + JSON.stringify(result['testsuites']['testsuite']['0']['testcase']['0']['failure']['0']['$']['message']));
				
				const failMessage = result['testsuites']['testsuite']['0']['testcase']['0']['failure']['0']['$']['message'];
				const expected = failMessage.replace('Expected: ','').replace(/ but was: .*$/,'');
				const got = failMessage.replace(/^.* but was: /,'');
				const message = vscode.TestMessage.diff(`Expected ${item.label}`, String(expected), String(got));
				options.failed(item, message, duration);
			} else if(testCount[0] > 0)
				options.passed(item, duration);
			else
				options.skipped(item);
		});
	}

}
