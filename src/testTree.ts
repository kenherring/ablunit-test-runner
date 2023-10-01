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
		// await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
		// const actual = this.evaluate();
		let itemPath = vscode.workspace.asRelativePath(item.uri!.fsPath).replace('src/test/','');
		if(item.label.startsWith('testMethod'))
			itemPath = itemPath + '#' + item.label; 

		// console.log("run0: " + item.uri + " " + item.uri?.path + " " + item.uri?.fsPath);
		// console.log("run1: " + item.id + " " + item.parent + " " + item.label + " " + item.children);
		// console.log("vscode dir=" + vscode.workspace.workspaceFolders?.map(item => item.uri.path));

		const workspaceDir = vscode.workspace.workspaceFolders?.map(item => item.uri.fsPath);

		const cmd =  'pwd && echo $0 && _progres -b -p ABLUnitCore.p -basekey INI -ininame progress.ini -param "' + itemPath + ' CFG=ablunit.json"';
		console.log("cmd=" + cmd);
		// const cmd = "pwd"
		await new Promise<string>((resolve, reject) => {
			const { exec } = require('child_process');
			cp.exec
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
			const errors: any[] = result['testsuites']['$']['errors'];
			const failures: any[] = result['testsuites']['$']['failures'];
			const tests: any[] = result['testsuites']['$']['tests'];
			console.log(errors + " " + failures + " " + tests);
			

			if(errors[0] > 0)
				options.errored(item, new vscode.TestMessage("Error"), duration);
			else if(failures[0] > 0)
				options.failed(item, new vscode.TestMessage("Failed"));
			else if(tests[0] > 0)
				options.passed(item, duration);
			else
				options.skipped(item);
		});


		// if (actual === this.expected) {
			options.passed(item, duration);
		// } else {
		// 	const message = vscode.TestMessage.diff(`Expected ${item.label}`, String(this.expected), String(actual));
		// 	message.location = new vscode.Location(item.uri!, item.range!);
		// 	options.failed(item, message, duration);
		// }
	}

	// private evaluate() {
	// 	switch (this.operator) {
	// 		case '-':
	// 			return this.a - this.b;
	// 		case '+':
	// 			return this.a + this.b;
	// 		case '/':
	// 			return Math.floor(this.a / this.b);
	// 		case '*':
	// 			return this.a * this.b;
	// 	}
	// }
}
