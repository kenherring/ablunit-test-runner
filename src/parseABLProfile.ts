import { Uri, workspace } from 'vscode';
import { ABLProfileJSON } from './ABLProfileSections'
import { TextDecoder } from 'util';

const textDecoder = new TextDecoder('utf-8');

export const getContentFromFilesystem = async (uri: Uri) => {
	try {
		const rawContent = await workspace.fs.readFile(uri);
		return textDecoder.decode(rawContent);
	} catch (e) {
		console.warn(`Error providing tests for ${uri.fsPath}`, e);
		return '';
	}
}

export class ABLProfile {

	profJSON: ABLProfileJSON | undefined

	async parseData(filepath: Uri) {
		const text = await getContentFromFilesystem(filepath)
		const lines = text.replace(/\r/g,'').split('\n')

		var sectionLines: string[][] = []
		var linesArr: string[] = []
		var currentSection: number
		sectionLines[0] = []
		currentSection = 1

		for (let lineNo = 0; lineNo < lines.length; lineNo++) {
			if(lines[lineNo] === '.' && (currentSection != 6 || lines[lineNo + 1] === '.')) {
				sectionLines[currentSection] = linesArr
				currentSection++
				linesArr = []
			} else {
				linesArr[linesArr.length] = lines[lineNo]
			}
		}

		this.profJSON = new ABLProfileJSON(sectionLines[1][0])
		this.profJSON.addModules(sectionLines[2])
		this.profJSON.addCallTree(sectionLines[3])
		this.profJSON.addLineSummary(sectionLines[4])
		this.profJSON.addTracing(sectionLines[5])
		this.profJSON.addCoverage(sectionLines[6])
		this.profJSON.addUserData(sectionLines[7])
		this.profJSON.addSection8(sectionLines[8])
	}

	writeJsonToFile (file: Uri) {
		workspace.fs.writeFile(file, Uint8Array.from(Buffer.from(JSON.stringify(this.profJSON, null, 2))))
	}

	provideFileCoverage () {
		console.log("provideFileCoverage")
	}
}

// const prof = new ABLProfile(Uri.parse("C:/git/ablunit-test-provider/test_projects/proj1/prof.out"));
// prof.writeJsonToFile(Uri.parse("c:/git/ablunit-test-provider/prof.json"))
