console.log("test");
import { 
	RawProfileSection,
	ABLProfileSection1,
	ABLProfileSection2,
	ABLProfileSection3,
	ABLProfileSection4,
	ABLProfileSection5,
	ABLProfileSection6,
	ABLProfileSection7,
	ABLProfileData
} from './ABLProfileSections';

const section1 = /^(\S+) at line ([0-9]+) +\((\S+)\)$/

export class ABLProfile {
	section1: ABLProfileSection1
	section2: ABLProfileSection2
	// section3: ABLProfileSection3
	section4: ABLProfileSection4
	// section5: ABLProfileSection5
	section6: ABLProfileSection6
	// section7: ABLProfileSection7

	constructor(filepath: string) {
		
		const fs = require('fs');
		
		const text = fs.readFileSync(filepath, "utf8").replaceAll('\r','')
		const lines = text.split('\n')
		
		var sectionLines: RawProfileSection[] = []
		var linesArr: string[] = []
		var currentSection: number
		sectionLines[0] = new RawProfileSection()
		currentSection = 1
		console.log("num-lines:" + lines.length)

		for (let lineNo = 0; lineNo < lines.length; lineNo++) {
			// console.log(lineNo + " - " + lines[lineNo])
			if(lines[lineNo] == '.' && (currentSection != 6 || lines[lineNo + 1] == '.')) {
				console.log("NEW SECTION: " + currentSection + " (line: " + lineNo + ")");
				console.log("LAST LINE: " + lines[lineNo -1])
				console.log(linesArr.length + " " + sectionLines.length)
				
				sectionLines[currentSection] = new RawProfileSection()
				sectionLines[currentSection].lines = linesArr
				currentSection++
				linesArr = []
			} else {
				linesArr[linesArr.length] = lines[lineNo]
			}
		}

		console.log("1-0: " + sectionLines[1].lines[0])
		console.log("2-0: " + sectionLines[2].lines[0])
		console.log("3-0: " + sectionLines[3].lines[0])

		console.log("section1")
		this.section1 = new ABLProfileSection1(sectionLines[1].lines[0])
		
		console.log("section4")
		this.section4 = new ABLProfileSection4(sectionLines[4].lines)
		console.log("section2")
		this.section2 = new ABLProfileSection2(sectionLines[2].lines, this.section4.lineSummary)
		// console.log("section3")
		// this.section3 = new ABLProfileSection3(sectionLines[3].lines)
		// console.log("section5")
		// this.section5 = new ABLProfileSection3(sectionLines[5].lines)
		// console.log("section6: " + sectionLines[6].lines.length)
		this.section6 = new ABLProfileSection6(sectionLines[6].lines)
		// console.log("section7: " + sectionLines[7].lines.length)
		// this.section7 = new ABLProfileSection3(sectionLines[7].lines)
		// console.log("section8: " + sectionLines[8].lines.length)
		// console.log("section9: " + sectionLines[9].lines.length)
		// console.log("section10: " + sectionLines[10].lines.length)

		// console.log("DONE1: " + JSON.stringify(this.section1))
		// console.log("DONE2: " + JSON.stringify(this.section2))
		
		// var profJson = new ABLProfileData()
		// profJson.addSection1(this.section1)
		// profJson.addModuleData(this.section2)
		// profJson.addCoverageData(this.section6)

		
		console.log("profJson = " + JSON.stringify(this.section2))

		// console.log("0: " + JSON.stringify(this.section2.modules[135]))

		fs.writeFile("c:/git/ablunit-test-provider/prof.json", JSON.stringify(this.section2, null, 2), function(err: any) {
			console.log(1)
			if (err) {
				console.log(2)
				console.log(err);
				console.log(3)
			}
		});


		
	}
}

console.log("init")
const prof = new ABLProfile("C:/git/ablunit-test-provider/test_projects/proj1/prof.out");
console.log("DONE: " + prof)

