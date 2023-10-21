import { Uri } from "vscode"

const summaryRE = /^(\d+) (\d{2}\/\d{2}\/\d{4}) "([^"]*)" (\d{2}:\d{2}:\d{2}) "([^"]*)" (.*)$/
const moduleRE = /^(\d+) "([^"]*)" "([^"]*)" (\d+) (\d+) "([^"]*)"$/
//CALL TREE: CallerID CallerLineno CalleeID CallCount
const callTreeRE = /^(\d+) (-?\d+) (\d+) (\d+)$/
//LINE SUMMARY: ModuleID LineNo ExecCount ActualTime CumulativeTime
const lineSummaryRE = /^(-?\d+) (-?\d+) (\d+) (\d+\.\d+) (\d+\.\d+)$/
//TRACING: ModuleID LineNo ActualTime StartTime
const tracingRE = /^(\d+) (\d+) (\d+\.\d+) (\d+\.\d+)$/
//COVERAGE:
const coverageRE = /^(\d+) "([^"]*)" (\d+)$/


interface Trace { //Section 5
    StartTime: number,
    ActualTime: number
}

export interface LineSummary { //Section 4
    LineNo: number
    ExecCount?: number
    ActualTime?: number
    CumulativeTime?: number
    Executable: boolean
    trace?: Trace[]
}

interface CalledBy{ //Section 3
    CallerModuleID: number
    CallerLineNo: number
    CallCount: number
}

interface CalledTo{ //Section 3
    CalleeModuleID: number
    CallerLineNo: number
    CallCount: number
}

//Split module and child module?
export interface Module { //Section 2
    ModuleID: number
    ParentModuleId?: number
    ModuleName: string
    EntityName?: string // function/procedure/method name
    SourceName: string // source file
    SourceUri?: Uri
    ParentName?: string // parent class, when inheriting
    Destructor?: boolean
    ListingFile?: string
    CrcValue: number
    ModuleLineNum: number
    UnknownString1: string
    coverageName?: string
    executableLines: number
    executedLines: number
    coveragePct: number
    lineCount: number
    calledBy?: CalledBy[]
    calledTo: CalledTo[]
    childModules?: Module[]
    lines: LineSummary[]
}

export class ABLProfileJSON {
    version: number
	systemDate: string
	systemTime?: string
	description?: string
	userID?: string
    properties?: {[key: string]: string}
	// otherInfo: string
	// StmtCnt: string | undefined
    modules: Module[] = []

    constructor(line: string) {
        const test = summaryRE.exec(line)
        if(test) {
            this.version = Number(test[1])
            this.systemDate = test[2]
            this.systemTime = test[4]
            this.description = test[3]
            this.userID = test[5]
            this.properties = JSON.parse(test[6].replace(/\\/g,'/'))
        } else {
            throw (new Error("Unable to parse profile data in section 1"))
        }
    }

    addModules (lines: string[]) {
        this.modules = []
        const childModules: Module[] = []
        for(const element of lines){
            const test = moduleRE.exec(element)

            const mod: Module = {
                ModuleID: Number(test![1]),
                ModuleName: test![2],
                SourceName: test![2],
                ListingFile: test![3],
                CrcValue: Number(test![4]),
                ModuleLineNum: Number(test![5]),
                UnknownString1: test![6],
                executableLines: 0,
                executedLines: 0,
                coveragePct: 0,
                lineCount: 0,
                lines: [],
                calledBy: [],
                calledTo: []
            }
            mod.Destructor = (mod.ModuleName.startsWith("~"))
            const split = mod.ModuleName.split(" ")
                if (split.length >= 4) {
                    console.error("SPLIT4!!!!! " + element)
                } else {
                    mod.EntityName = split[0]
                    if (split.length == 1) {
                        mod.SourceName = split[0]
                    } else {
                        if (split[1]) {
                            mod.SourceName = split[1]
                        }
                        if (split[2]) {
                            mod.ParentName = split[2]
                        }
                    }
                }

            if (Number(test![4]) != 0) {
                this.modules[this.modules.length] = mod
            } else {
                childModules[childModules.length] = mod
            }
        }

        childModules.forEach(child => {
            let parent = this.modules.find(p => p.SourceName === child.SourceName)
            if (!parent) {
                parent = this.modules.find(p => p.SourceName === child.SourceName)
            }
            if(parent) {
                if(!parent.childModules) {
                    parent.childModules = []
                }
                child.ParentModuleId = parent.ParentModuleId // TODO: is this in the JSON?
                parent.childModules[parent.childModules.length] = child
                if (parent.SourceName === child.SourceName) {
                    parent.SourceName = child.SourceName
                }
            } else {
                throw new Error("Unable to find parent module for " + child.SourceName + " " + child.coverageName + " " + child.ModuleName)
            }
        })
    }

    getModule(modID: number): Module | undefined {
        for(const element of this.modules){
            if(element.ModuleID === modID)
                return element
        }
        const parent = this.modules.find(mod => mod.childModules?.find(child => child.ModuleID == modID))
        if(parent)
            return parent.childModules?.find(child => child.ModuleID == modID)

    }

    getModuleLine(modID: number, lineNo: number): LineSummary | undefined {
        const mod = this.getModule(modID)
        if(mod) {
            for(const element of mod.lines) {
                if(element.LineNo === lineNo)
                    return element
            }
        }
    }

    getLine(mod: Module, lineNo: number): LineSummary | undefined {
        for(const element of mod.lines) {
            if(element.LineNo == lineNo)
                return element
        }
    }


    addCallTree (lines: string[]) {
        for(const element of lines){
            const test = callTreeRE.exec(element)

            if(test && test.length == 5) {
                //Called By
                const cbModID = Number(test[3])
                const cb = {
                    CallerModuleID: Number(test[1]),
                    CallerLineNo: Number(test[2]),
                    CallCount: Number(test[4])
                }
                const mod = this.getModule(cbModID)
                if (mod?.calledBy != undefined) {
                    mod.calledBy[mod.calledBy.length] = cb
                }

                //Called To
                const ctModID = Number(test[1])
                const ct = {
                    CalleeModuleID: Number(test[3]),
                    CallerLineNo: Number(test[2]),
                    CallCount: Number(test[4])
                }

                const mod2 = this.getModule(ctModID)
                if (mod2?.calledTo != undefined) {
                    mod2.calledTo[mod2.calledTo.length] = ct
                }
            }
        }
    }

    addLineSummary (lines: string[]) {
        for(const element of lines){
            const test = lineSummaryRE.exec(element)

            if(test){
                const modID = Number(test[1])
                const sum = {
                    LineNo: Number(test[2]),
                    ExecCount: Number(test[3]),
                    Executable: true,
                    ActualTime: Number(test[4]),
                    CumulativeTime: Number(test[5])
                }
                const mod = this.getModule(modID)
                if (mod) {
                    if (! mod.lines) {
                        mod.lines = []
                    }
                    mod.lines[mod.lines.length] = sum
                    mod.lineCount++
                }
            }
        }
    }

    addTracing (lines: string[]) {
        for(const element of lines){
            const test = tracingRE.exec(element)
            if (test) {
                const modID = Number(test[1])
                const lineNo = Number(test[2])
                const trace = {
                    StartTime: Number(test[4]),
                    ActualTime: Number(test[3])
                }
                const line = this.getModuleLine(modID,lineNo)
                if (line) {
                    if(! line.trace) line.trace = []
                    line.trace[line.trace.length] = trace
                }

            }
        }
    }

    addCoverage(lines: string[]) {
        lines.unshift('.')
        let mod

        try {
            for(let lineNo=1; lineNo < lines.length; lineNo++){
                if (lines[lineNo] === '.') { continue }

                if (lines[lineNo - 1] === '.') {
                    //TODO - is the last last section being set?
                    // set info for the previous section
                    if(lines[lineNo] == '.' && mod) {
                        mod.coveragePct = (mod.executableLines / mod.lines.length * 100)
                    }

                    // prepare the next section.
                    const test = coverageRE.exec(lines[lineNo])
                    if (!test) {
                        throw new Error("Unable to parse coverage data in section 6")
                    }

                    mod = this.getModule(Number(test[1]))
                    if (!mod) {
                        throw new Error("Unable to find module " + test[1] + " in section 6")
                    }

                    mod.coverageName = test[2]
                    mod.executableLines = Number(test[3])
                    continue
                }
                if(!mod) { throw new Error("invalid data in section 6") }

                const line = this.getLine(mod,Number(lines[lineNo]))
                if (line) {
                    line.Executable = true
                } else {
                    mod.lines[mod.lines.length] = {
                        LineNo: Number(lines[lineNo]),
                        Executable: true
                    }
                }
            }
        } catch (error) {
            console.error("Error parsing coverage data in section 6 [module=" + mod + "]: error=" + error)
        }
        this.assignParentCoverage()
    }

    assignParentCoverage() {
        this.modules.forEach(parent => {
            parent.childModules?.forEach(child => {
                parent.executableLines += child.executableLines
                parent.executedLines += child.executedLines
                if(child.lines) {
                    child.lines.forEach(line => {
                        const parentLine = parent.lines.find(l => l.LineNo == line.LineNo)
                        if(parentLine) {
                            parentLine.ExecCount = line.ExecCount
                            parentLine.ActualTime = line.ActualTime
                            parentLine.CumulativeTime = line.CumulativeTime
                        } else {
                            parent.lines[parent.lines.length] = line
                        }
                    });

                }
            })
        })
    }

    addUserData(lines: string[]) {
        for(let lineNo=0; lineNo < lines.length; lineNo++){
            console.log("TODO: UserData-" + lineNo + ": " + lines[lineNo])
        }
    }
}
