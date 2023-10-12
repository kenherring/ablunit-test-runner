import { devNull } from "os"

const moduleDataRE = /^([0-9]+) ("[^"]*") ("[^"]*") ([0-9]+) ([0-9]+) ("[^"]*")$/
const callTreeRE = /^([0-9]+) (-?[0-9]+) ([0-9]+) ([0-9]+)$/
const lineSummaryRE = /^(-?[0-9]+) (-?[0-9]+) ([0-9]+) ([0-9]+\.[0-9]+) ([0-9]+\.[0-9]+)$/
// const tracingRE = /^$/
const coverageRE = /^([0-9]+) ("[^"]*") ([0-9]+)$/
// const userRE = /^$/

export interface ProfileSectionLines1 {
	[section: number]: {
		lineNo: number
		line: string
	}
    length: number
}

export class RawProfileSection {
    lines: string[] = []
}

export class ModuleData { //Section 2
	ModuleID: number
	ModuleName: string
	ListingFile: string
	CrcValue: number
	TableCrcValue: number
	UnknownString1: string

    constructor(text: string) {
        const values = moduleDataRE.exec(text)
        this.ModuleID = Number(values![1])
        this.ModuleName = values![2]
        this.ListingFile = values![3]
        this.CrcValue = Number(values![4])
        this.TableCrcValue = Number(values![5])
        this.UnknownString1 = values![6]
    }
}

export class profJson {
    modules: Module[] = []
}

export class Modules { //Section 2
    [ModuleID: number]: Module
    // mod2: Module[] = []
}


export interface Module { //Section 2
    ModuleID: number,
    ModuleName: string,
    ListingFile: string,
    CrcValue: number,
    TableCrcValue: number,
    UnknownString1: string,
    lines: LineSummary[]
}

export interface LineSummary { //Section 4
    line: number
    execCount: number
    actualTime: number
    cumulativeTime: number
}

export class CallTreeData { //Section 3
    CallerID: number
    CallerLineno: number
    CalleeID: number
    CallCount: number

    constructor(text: string) {
        const values = callTreeRE.exec(text)
        this.CallerID = Number(values![1])
        this.CallerLineno = Number(values![2])
        this.CalleeID = Number(values![3])
        this.CallCount = Number(values![4])
    }
}


export class LineSummaryData { //Section 4
    [ModuleID: number]: LineSummary[]
    
    constructor() {}

    addLine(modID: number, lineSum: LineSummary) {
        if(this[modID] == undefined) {
            this[modID] = []
        }
        this[modID][this[modID].length] = lineSum
    }
}

export interface TracingData { //Section 5
    ModuleID: number
    LineNo: number
    ActualTime: number
    StartTime: number
}

export class CoverageData { //Section 6
    ModuleID: number
    EntryName: string
    LineCount: number
    lines: number[]

    constructor(text: string, lines: number[]) {
        const values = coverageRE.exec(text)
        this.ModuleID = Number(values![1])
        this.EntryName = values![2]
        this.LineCount = Number(values![3])
        this.lines = lines
    }
}

export interface UserData { //Section 7
    WriteTime: number
    UserData: string
}

export class ABLProfileSection1 { //Description Data Section
	version: number
	// profileDate: Date
	description: string
	systemTime: string
	userId: string
	// otherInfo: string
	// StmtCnt: string | undefined

	constructor (text: string) {
		const values = text.split(" ")
		this.version = Number(values[0])
		// this.profileDate = values[1]
		this.description = values[2]
		this.systemTime = values[3]
		this.userId = values[4]
	}
}

export class ABLProfileSection2 { //Module Data Section
    prof: profJson

    constructor(lines: string[], lineSum: LineSummaryData) {
        console.log("section2.length = " + lines.length);

        this.prof = new profJson()


        for (let lineNo = 0; lineNo < lines.length; lineNo++) {
            const mod = new ModuleData(lines[lineNo])
        
            let module = {
                "ModuleID": mod.ModuleID,
                "ModuleName": mod.ModuleName,
                "ListingFile": mod.ListingFile,
                "CrcValue": mod.CrcValue,
                "TableCrcValue": mod.TableCrcValue,
                "UnknownString1": mod.UnknownString1,
                "lines": lineSum[mod.ModuleID]
            }
            this.prof.modules[this.prof.modules.length] = module
        }
	}
}

export class ABLProfileSection3 { //Call Tree Data Section
    [index: number]: CallTreeData

    constructor(lines: string[]) {
        for(let lineNo = 0; lineNo < lines.length; lineNo++) {
            this[lineNo] = new CallTreeData(lines[lineNo])
        }
    }
}

export class ABLProfileSection4 { //Line Summary Section
    lineSummary: LineSummaryData

    constructor(lines: string[]) { 
        console.log("section4.length = " + lines.length)
        var count = 0
        this.lineSummary = new LineSummaryData()

        for(let lineNo = 0; lineNo < lines.length; lineNo++) {
            const values = lineSummaryRE.exec(lines[lineNo])
            const moduleId = Number(values![1])

            this.lineSummary.addLine(moduleId,{
                    "line": Number(values![2]),
                    "execCount": Number(values![3]),
                    "actualTime": Number(values![4]),
                    "cumulativeTime": Number(values![5])
                }
            )
        }
    }
}

export class ABLProfileSection5 { //Tracing Data Section
    constructor(lines: string[]) { }
}

export class ABLProfileSection6 { //Coverage Data Section
    [index: number]: CoverageData

    constructor(lines: string[]) {
        console.log("section6.length = " + lines.length)
        var count = 0
        for(let lineNo = 0; lineNo < lines.length; lineNo++) {

            const firstLine = lines[lineNo]
            const execLines: number[] = []

            while(lines[lineNo] != '.' && lines[lineNo] != null) {
                execLines[execLines.length] = Number(lines[lineNo])
                lineNo++
            }
            this[count] = new CoverageData(firstLine, execLines)
            count++
        }
    }
}

export class ABLProfileSection7 { //User Data Section
    constructor(lines: string[]) { }
}

export class ABLProfileData { //for JSON formatting and easy consumption
    version: number = 0
    description: string = ""
    systemTime: string = ""
    userid: string = ""
    modules!: ModuleData[]

    constructor () { }

    addSection1(section1: ABLProfileSection1):void {
        this.version = section1.version
        this.description = section1.description
        this.systemTime = section1.systemTime
        this.userid = section1.userId
    }

    // addModuleData(section2: ABLProfileSection2) {
    //     this.modules = section2
    // }

    // addCoverageData(section6: ABLProfileSection6) {
    //     this.modules['']
    // }
}

