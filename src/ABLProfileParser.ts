import { Uri, workspace } from 'vscode';
import { ABLProfileJSON } from './ABLProfileSections'
import { TextDecoder } from 'util';
import { PropathParser } from './ABLPropath';
import { ABLUnitConfig } from './ABLUnitConfig';

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
	cfg!: ABLUnitConfig
	resultsPropath!: PropathParser

	async parseData(filepath: Uri, propath: PropathParser) {
		const text = await getContentFromFilesystem(filepath)
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

		this.profJSON = new ABLProfileJSON(sectionLines[1][0])
		propath.setPropath(this.profJSON.properties!.Propath)
		this.profJSON.addModules(sectionLines[2])

		for (const mod of this.profJSON.modules) {
			if (mod.SourceName) {
				await propath.setSourcePropathInfo(mod.SourceName)
			}
		}

		this.profJSON.addCallTree(sectionLines[3])
		this.profJSON.addLineSummary(sectionLines[4])
		this.profJSON.addTracing(sectionLines[5])
		this.profJSON.addCoverage(sectionLines[6])
		// this.profJSON.addUserData(sectionLines[7])
		// this.profJSON.addSection8(sectionLines[8])

		// TODO - this doesn't work
		// this.profJSON.modules.sort()
	}

	async writeJsonToFile (file: Uri) {
		// Filter out the OpenEdge.* classes
		// TODO: should this be optional?
		const out: ABLProfileJSON = JSON.parse(JSON.stringify(this.profJSON))
		out.modules = out.modules.filter((m) => (!m.ModuleName?.startsWith('OpenEdge.')))

		workspace.fs.writeFile(file, Uint8Array.from(Buffer.from(JSON.stringify(out, null, 2)))).then(() => {
			console.log("wrote profile output json file: " + file.fsPath)
		}, (err) => {
			console.log("failed to write profile output json file " + file.fsPath + " - " + err)
		})
	}

	provideFileCoverage () {
		console.log("TODO  !!!!! provideFileCoverage !!!!!")
	}
}

// const prof = new ABLProfile(Uri.parse("C:/git/ablunit-test-provider/test_projects/proj1/prof.out"));
// prof.writeJsonToFile(Uri.parse("c:/git/ablunit-test-provider/prof.json"))
