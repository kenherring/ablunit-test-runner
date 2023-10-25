import { Uri } from "vscode"
import { ABLDebugLines } from "./ABLDebugLines"

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

interface UserData { //Section 9
	time: number,
	data: string
}

interface ISectionEight {
	ModuleID: number
	field2: number
	field3: number
	field4: string
}

interface ISectionNine { //-statistics?
	ModuleID: number
	fields: string[]
}

interface ISectionTen {
	ModuleID: number,
	remainder: string
}

interface ISectionTwelve {
	ModuleID: number,
	field1: number,
	field2: number,
	field4: number,
	field5: number,
	field6: number,
	remainder: string
}

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
	srcLine?: number
	srcUri?: Uri
	incLine?: number
	incUri?: Uri
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
	ModuleName: string
	EntityName?: string // function/procedure/method name
	SourceUri?: Uri
	SourceName: string // source file
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
	calledBy: CalledBy[]
	calledTo: CalledTo[]
	childModules: Module[]
	lines: LineSummary[]
	ISectionEight: ISectionEight[]
	ISectionNine: ISectionNine[]
	ISectionTen: ISectionTen[]
	ISectionTwelve: ISectionTwelve[]
}

export interface ProfileData {
	modules: Module[]
	userData: UserData[]
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
	userData: UserData[] = []
	debugLines: ABLDebugLines

	constructor(lines: string[], debugLines: ABLDebugLines) {
		this.debugLines = debugLines
		if (lines.length > 1) {
			throw new Error("Invalid profile data - section 1 should have exactly one line")
		}
		const test = summaryRE.exec(lines[0])
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

			const moduleName = test![2]
			let entityName: string | undefined = undefined
			let sourceName: string = ""
			let parentName: string | undefined
			const destructor: boolean = (moduleName.startsWith("~"))
			const split = moduleName.split(" ")

			if (split.length >= 4) {
				throw new Error("Unable to parse module name - has 4 sections which is more than expected: " + moduleName)
			}

			entityName = split[0]
			if (split.length == 1) {
				sourceName = split[0]
			} else {
				if (split[1]) {
					sourceName = split[1]
				}
				if (split[2]) {
					parentName = split[2]
				}
			}

			const mod: Module = {
				ModuleID: Number(test![1]),
				ModuleName: moduleName,
				EntityName: entityName,
				SourceName: sourceName,
				SourceUri: undefined,
				ParentName: parentName,
				ListingFile: test![3],
				CrcValue: Number(test![4]),
				ModuleLineNum: Number(test![5]),
				Destructor: destructor,
				UnknownString1: test![6],
				executableLines: 0,
				executedLines: 0,
				coveragePct: 0,
				lineCount: 0,
				childModules: [],
				lines: [],
				calledBy: [],
				calledTo: [],
				ISectionEight: [],
				ISectionNine: [],
				ISectionTen: [],
				ISectionTwelve: []
			}

			if (Number(test![4]) != 0) {
				this.modules[this.modules.length] = mod
			} else {
				childModules[childModules.length] = mod
			}
		}
		this.addChildModulesToParents(childModules)
	}

	addChildModulesToParents(childModules: Module[]) {
		childModules.forEach(child => {
			const parent = this.modules.find(p => p.SourceName === child.SourceName)

			if(parent) {
				parent.childModules[parent.childModules.length] = child
				if (parent.SourceName === child.SourceName) {
					parent.SourceName = child.SourceName
				}
			} else {
				console.log(JSON.stringify(child))
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

	async addLineSummary (lines: string[]) {
		for(const element of lines){
			const test = lineSummaryRE.exec(element)

			if(test){
				const modID = Number(test[1])
				const sourceName = this.getModule(modID)?.SourceName
				const sum: LineSummary = {
					LineNo: Number(test[2]),
					ExecCount: Number(test[3]),
					Executable: true,
					ActualTime: Number(test[4]),
					CumulativeTime: Number(test[5])
				}
				if (sourceName) {
					const lineinfo = await this.debugLines.getSourceLine(sourceName, sum.LineNo)
					if (lineinfo) {
						sum.srcLine = lineinfo.srcLine
						sum.srcUri = lineinfo.srcUri
						sum.incLine = lineinfo.incLine
						sum.incUri = lineinfo.incUri
					}
				}
				const mod = this.getModule(modID)
				if (mod) {
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

	// https://community.progress.com/s/article/What-information-is-provided-by-PROFILER-COVERAGE-Method

	addCoverage(lines: string[]) {
		lines.unshift('.')
		let mod

		try {
			for(let lineNo=1; lineNo < lines.length; lineNo++){
				if (lines[lineNo] === '.') {
					if (mod) {
						// set info for the previous section
						mod.coveragePct = (mod.executableLines / mod.lines.length * 100)
					}
					continue
				}

				if (lines[lineNo - 1] === '.') {
					//TODO - is the last last section being set?

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
				child.lines.sort((a,b) => a.LineNo - b.LineNo)
			})
			parent.lines.sort((a,b) => a.LineNo - b.LineNo)
			parent.childModules.sort((a,b) => a.ModuleID - b.ModuleID)
		})
	}

	addSection7(lines: string[]) {
		console.error("section 7 not implemented.  line count = " + lines.length)
	}

	// https://docs.progress.com/bundle/abl-reference/page/STATISTICS-attribute.html
	// https://community.progress.com/s/article/What-s-the-PROFILER-STATISTICS-method
	// PROFILER:STATISTICS has 4 sections ()
	// 1. Operation Section
	// 2. Module Detail Section
	// 3. Sessions Watermark Section
	// 4. Parameter and Database Section
	//
	// What else can we do with this information?

	//Examples:
	//114 10036 4 "TY_ASGNODBFLD "
	//114 37 15 "ECONST"
	//114 58 2 "RETRY"
	addSection8(lines: string[]) {
		// const sectRE = /&(\d+) (\d+) (-?\d+) (-?\d+) (\d+\.\d+) (.*)$/
		const sectRE = /^(\d+) (\d+) (\d+) "(.*)"/
		if (!lines.length) { return }
		for(let lineNo=0; lineNo < lines.length; lineNo++){
			const test = sectRE.exec(lines[lineNo])
			if (test) {
				const ISectionEight: ISectionEight = {
					ModuleID: Number(test[1]),
					field2: Number(test[2]),
					field3: Number(test[3]),
					field4: test[4]
				}
				const mod = this.getModule(ISectionEight.ModuleID)
				if (mod) {
					mod.ISectionEight.push(ISectionEight)
				} else {
					console.error("Unable to find module " + ISectionEight.ModuleID + " in section 8")
					console.error("  - line='" + lines[lineNo] + "'")
				}
			} else {
				console.error("Unable to parse section 8 line " + lineNo + ": " + lines[lineNo])
				console.error("  - line='" + lines[lineNo] + "'")
			}
		}
	}

	addSection9(lines: string[]) {
		if (!lines.length) { return }
		const sectRE = /^(\d+) (.*)$/
		for(const element of lines){
			const test = sectRE.exec(element)
			if (test) {
				const ISectionNine: ISectionNine = {
					ModuleID: Number(test[1]),
					fields: test[2].trim().split(" ").filter(f => f.length > 0)
				}
				const mod = this.getModule(ISectionNine.ModuleID)
				if (mod) {
					mod.ISectionNine.push(ISectionNine)
				} else {
					console.error("Unable to find module " + ISectionNine.ModuleID + " in section 9")
					console.error("  - line='" + element + "'")
				}
			}
		}
	}

	addSection10(lines: string[]) {
		if (!lines.length) { return }
		const sectRE = /^(\d+) (.*)$/
		for(const element of lines){
			const test = sectRE.exec(element)
			if (test) {
				const ISectionTen: ISectionTen = {
					ModuleID: Number(test[1]),
					remainder: test[2]
				}
				const mod = this.getModule(ISectionTen.ModuleID)
				if (mod) {
					mod.ISectionTen.push(ISectionTen)
				} else {
					console.error("Unable to find module " + ISectionTen.ModuleID + " in section 10")
					console.error("  - line='" + element + "'")
				}
			}
		}
	}

	addSection11(lines: string[]) {
		console.error("section 11 not implemented.  line count = " + lines.length)
	}

	addSection12(lines: string[]) {
		const sectRE1 = /^(\d+) (\d+) (\d+) (\d+) (\d+) (\d+\.\d+) (.+)?$/
		const sectRE2 = /^(\d+) (\d+) (\d+) (\d+) (\d+) (\d+\.\d+)$/
		if (!lines.length) { return }
		for(const element of lines){
			let test = sectRE1.exec(element)
			if (!test) {
				test = sectRE2.exec(element)
			}
			if (test) {
				const ISectionTwelve: ISectionTwelve = {
					ModuleID: Number(test[3]),
					field1: Number(test[1]),
					field2: Number(test[2]),
					field4: Number(test[4]),
					field5: Number(test[5]),
					field6: Number(test[6]),
					remainder: test[7]
				}
				const mod = this.getModule(ISectionTwelve.ModuleID)
				if (mod) {
					mod.ISectionTwelve.push(ISectionTwelve)
				} else {
					console.error("Unable to find module " + ISectionTwelve.ModuleID + " in section 12")
					console.error("  - line='" + element + "'")
				}
			}
		}
	}

	addSection13(lines: string[]) {
		console.error("section 13 not implemented.  line count = " + lines.length)
	}
	addSection14(lines: string[]) {
		console.error("section 14 not implemented.  line count = " + lines.length)
	}

	addUserData(lines: string[]) {
		const userRE = /(\d+\.\d+) "(.*)"$/
		if (!lines.length) { return }
		for(const element of lines){
			console.log("userDataLine=" + element)
			const test = userRE.exec(element)
			if (test) {
				this.userData.push({
					time: Number(test[1]),
					data: test[2]
				})
			} else {
				throw new Error("Unable to parse user data")
			}
		}
	}
}
