import { Uri, workspace } from 'vscode';
import { ABLProfileJSON, ProfileData } from './ABLProfileSections'
import { TextDecoder } from 'util';
import { PropathParser } from './ABLPropath';
import { ABLUnitConfig } from './ABLUnitConfigWriter';
import { ABLDebugLines } from './ABLDebugLines';

const textDecoder = new TextDecoder('utf-8');

export const getContentFromFilesystem = async (uri: Uri) => {
	try {
		const rawContent = await workspace.fs.readFile(uri)
		return textDecoder.decode(rawContent)
	} catch (e) {
		// throw new Error(`Error reading ${uri.fsPath}: ${e}`)
		console.warn(`Error reading ${uri.fsPath}`, e)
		return ''
	}
}

export class ABLProfile {

	profJSON: ABLProfileJSON | undefined
	cfg!: ABLUnitConfig
	resultsPropath!: PropathParser
	debugLines: ABLDebugLines | undefined

	async parseData(filepath: Uri, debugLines: ABLDebugLines) {
		this.debugLines = debugLines
		console.log("filepath=" + filepath.fsPath)
		const text = await getContentFromFilesystem(filepath)
		console.log("2")
		const lines = text.replace(/\r/g,'').split('\n')

		const sectionLines: string[][] = []
		let linesArr: string[] = []
		let currentSection: number
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

		console.log("section1 " + sectionLines[1].length)
		this.profJSON = new ABLProfileJSON(sectionLines[1][0], debugLines)

		console.log("section2 " + sectionLines[2].length)
		this.profJSON.addModules(sectionLines[2])

		console.log("section3 " + sectionLines[3].length)
		this.profJSON.addCallTree(sectionLines[3])

		console.log("section4 " + sectionLines[4].length)
		await this.profJSON.addLineSummary(sectionLines[4])

		console.log("section5 " + sectionLines[5].length)
		this.profJSON.addTracing(sectionLines[5])

		console.log("section6 " + sectionLines[6].length)
		this.profJSON.addCoverage(sectionLines[6])

		console.log("section7 " + sectionLines[7].length)
		this.profJSON.addSection7(sectionLines[7])

		if(sectionLines.length > 11) {
			console.log("section8 " + sectionLines[8].length)
			this.profJSON.addSection8(sectionLines[8])

			console.log("section9 " + sectionLines[9].length)
			this.profJSON.addSection9(sectionLines[9])

			console.log("section10 " + sectionLines[10].length)
			this.profJSON.addSection10(sectionLines[10])

			console.log("section11 " + sectionLines[11].length)
			this.profJSON.addSection11(sectionLines[11])


			console.log("section12 " + sectionLines[12].length)
			this.profJSON.addSection12(sectionLines[12])

			console.log("section13 - User Data" + sectionLines[13].length)
			this.profJSON.addUserData(sectionLines[13])
		} else {

		console.log("section12 " + sectionLines[8].length)
		this.profJSON.addSection12(sectionLines[8])

		console.log("section13 - User Data" + sectionLines[9].length)
		this.profJSON.addUserData(sectionLines[9])
		}



		// console.log("section14 " + sectionLines[14].length)
		// this.profJSON.addSection14(sectionLines[14])

		console.log("done")

		this.profJSON.modules.sort((a,b) => a.ModuleID - b.ModuleID)
	}

	async writeJsonToFile (file: Uri) {
		// TODO: should writing json be optional?

		const data: ProfileData = {
			modules: this.profJSON!.modules,
			userData: this.profJSON!.userData,
		}
		// const out: ProfileData = JSON.parse(JSON.stringify(data))

		workspace.fs.writeFile(file, Uint8Array.from(Buffer.from(JSON.stringify(data, null, 2)))).then(() => {
			console.log("wrote profile output json file: " + file.fsPath)
		}, (err) => {
			console.error("failed to write profile output json file " + file.fsPath + " - " + err)
		})
	}

	provideFileCoverage () {
		console.log("TODO  !!!!! provideFileCoverage !!!!!")
	}
}

// const prof = new ABLProfile(Uri.parse("C:/git/ablunit-test-provider/test_projects/proj1/prof.out"));
// prof.writeJsonToFile(Uri.parse("c:/git/ablunit-test-provider/prof.json"))
