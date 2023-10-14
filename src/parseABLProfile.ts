import { Uri } from 'vscode';
import { ABLProfileJSON } from './ABLProfileSections'

export class ABLProfile {
	
	profJSON: ABLProfileJSON

	constructor(filepath: Uri) {
		
		const fs = require('fs');
		
		const text = fs.readFileSync(filepath.fsPath, "utf8").replaceAll('\r','')
		const lines = text.split('\n')
		
		var sectionLines: string[][] = []
		var linesArr: string[] = []
		var currentSection: number
		sectionLines[0] = []
		currentSection = 1
		console.log("num-lines:" + lines.length)

		for (let lineNo = 0; lineNo < lines.length; lineNo++) {
			// console.log(lineNo + " - " + lines[lineNo])
			if(lines[lineNo] == '.' && (currentSection != 6 || lines[lineNo + 1] == '.')) {
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
		const fs = require('fs');
		fs.writeFile(file.fsPath, JSON.stringify(this.profJSON, null, 2), function(err: any) {
			console.log(1)
			if (err) {
				console.log(2)
				console.log(err);
				console.log(3)
			}
		});
	}

	provideFileCoverage () {
		
	}
}

// const prof = new ABLProfile(Uri.parse("C:/git/ablunit-test-provider/test_projects/proj1/prof.out"));
// prof.writeJsonToFile(Uri.parse("c:/git/ablunit-test-provider/prof.json"))

