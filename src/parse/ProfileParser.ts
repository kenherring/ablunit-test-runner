import { DeclarationCoverage, Position, Range, Uri, workspace } from 'vscode'
import { PropathParser } from '../ABLPropath'
import { ABLDebugLines } from '../ABLDebugLines'
import { log } from '../ChannelLogger'
import * as FileUtils from '../FileUtils'
import { Duration } from 'ABLUnitCommon'

class ModuleIgnored extends Error {
	constructor (public moduleId: number) {
		super('module ignored: ' + moduleId)
		this.name = 'ModuleIgnored'
	}
}

export class ABLProfile {
	profJSON?: ABLProfileJson

	async parseData (uri: Uri, writeJson: boolean, debugLines?: ABLDebugLines, ignoreExternalCoverage = true, propath?: PropathParser) {
		if (!debugLines) {
			// unit testing setup
			debugLines = new ABLDebugLines()
			if (propath) {
				debugLines.propath = propath
			} else {
				throw new Error('propath not set')
			}
		}

		FileUtils.validateFile(uri)
		const lines = FileUtils.readLinesFromFileSync(uri)

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

		log.debug('section1 ' + sectionLines[1].length)
		this.profJSON = new ABLProfileJson(uri, sectionLines[1], debugLines, ignoreExternalCoverage)
		log.debug('section2 ' + sectionLines[2].length)
		await this.profJSON.addModules(sectionLines[2])
		log.debug('section3 ' + sectionLines[3].length)
		this.profJSON.addCallTree(sectionLines[3])
		log.debug('section4 ' + sectionLines[4].length)
		await this.profJSON.addLineSummary(sectionLines[4])
		log.debug('section5 ' + sectionLines[5].length)
		this.profJSON.addTracing(sectionLines[5])
		log.debug('section6 ' + sectionLines[6].length)
		await this.profJSON.addCoverage(sectionLines[6])
		log.debug('section7 ' + sectionLines[7].length)
		this.profJSON.addSection7(sectionLines[7])
		log.debug('sectionLines.length=' + sectionLines.length)
		if(sectionLines.length > 11) {
			log.debug('section8 ' + sectionLines[8].length)
			this.profJSON.addSection8(sectionLines[8])
			log.debug('section9 ' + sectionLines[9].length)
			this.profJSON.addSection9(sectionLines[9])
			log.debug('section10 ' + sectionLines[10].length)
			this.profJSON.addSection10(sectionLines[10])
			log.debug('section11 ' + sectionLines[11].length)
			this.profJSON.addSection11(sectionLines[11])
			log.debug('section12 ' + sectionLines[12].length)
			this.profJSON.addSection12(sectionLines[12])
			log.debug('section13 - User Data' + sectionLines[13].length)
			this.profJSON.addUserData(sectionLines[13])
		} else {
			log.debug('section12 ' + sectionLines[8].length)
			this.profJSON.addSection12(sectionLines[8])
			log.debug('section13 - User Data' + sectionLines[9].length)
			this.profJSON.addUserData(sectionLines[9])
		}

		this.profJSON.modules.sort((a, b) => a.ModuleID - b.ModuleID)
		log.debug('parsing profiler data complete (modules.length=' + this.profJSON.modules.length + ')')
		if (writeJson) {
			const jsonUri = Uri.file(uri.fsPath.replace(/\.[a-zA-Z]+$/, '.json'))
			// eslint-disable-next-line promise/catch-or-return
			this.writeJsonToFile(jsonUri).then(() => {
				return true
			}, (e: unknown) => {
				log.error('Error writing profile output json file: ' + e)
				return false
			})
		}
		log.debug('parseData returning')
		this.profJSON.endParse()
		return this.profJSON
	}

	writeJsonToFile (uri: Uri) {
		const data: IProfileData = {
			modules: this.profJSON!.modules,
			userData: this.profJSON!.userData,
		}
		return workspace.fs.writeFile(uri, Uint8Array.from(Buffer.from(JSON.stringify(data, null, 2)))).then(() => {
			log.info('wrote profile output json file: ' + workspace.asRelativePath(uri))
			return
		}, (e: unknown) => {
			log.error('failed to write profile output json file ' + workspace.asRelativePath(uri) + ' - ' + e)
		})
	}
}



const summaryRE = /^(\d+) (\d{2}\/\d{2}\/\d{4}) "([^"]*)" (\d{2}:\d{2}:\d{2}) "([^"]*)" (.*)$/
const moduleRE = /^(\d+) "([^"]*)" "([^"]*)" (\d+) (\d+) "([^"]*)"$/
const moduleRE2 = /^(\d+) "([^"]*)" "([^"]*)" (\d+)$/
// CALL TREE: CallerID CallerLineno CalleeID CallCount
const callTreeRE = /^(\d+) (-?\d+) (\d+) (\d+)$/
// LINE SUMMARY: ModuleID LineNo ExecCount ActualTime CumulativeTime
const lineSummaryRE = /^(-?\d+) (-?\d+) (\d+) (\d+\.\d+) (\d+\.\d+)$/
// TRACING: ModuleID LineNo ActualTime StartTime
const tracingRE = /^(\d+) (\d+) (\d+\.\d+) (\d+\.\d+)$/
// COVERAGE:
const coverageRE = /^(\d+) "([^"]*)" (\d+)$/

interface IUserData { // Section 9
	time: number,
	data: string
}

interface ISectionEight {
	ModuleID: number
	field2: number
	field3: number
	field4: string
}

interface ISectionNine { // -statistics?
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

interface ITrace { // Section 5
	StartTime: number,
	ActualTime: number
}

export interface ILineSummary { // Section 4
	LineNo: number
	ExecCount: number
	ActualTime?: number
	CumulativeTime?: number
	Executable: boolean
	trace?: ITrace[]
	srcLine?: number
	srcUri?: Uri
	incLine?: number
	incUri?: Uri
}

class LineSummary {
	ExecCount: number
	ActualTime?: number
	CumulativeTime?: number
	trace?: ITrace[]
	srcLine?: number
	srcUri?: Uri
	incLine?: number
	incUri?: Uri

	constructor (public readonly LineNo: number, public readonly Executable: boolean) {
		this.ExecCount = 0
	}

	get incPath () {
		if (this.incUri) {
			return this.incUri.fsPath
		}
		return undefined
	}
	set incPath (path: string | undefined) {
		if (path) {
			this.incUri = Uri.file(path)
			return
		}
		this.incUri = undefined
	}

	get srcPath () {
		return this.srcUri?.fsPath
	}
	set srcPath (path: string | undefined) {
		if (path) {
			this.srcUri = Uri.file(path)
			return
		}
		this.srcUri = undefined
	}

	toJson () {
		return {
			LineNo: this.LineNo,
			ExecCount: this.ExecCount,
			ActualTime: this.ActualTime,
			CumulativeTime: this.CumulativeTime,
			Executable: this.Executable,
			trace: this.trace,
			srcLine: this.srcLine,
			srcPath: this.srcPath,
			incLine: this.incLine,
			incPath: this.incPath,
		}
	}
}

interface ICalledBy { // Section 3
	CallerModuleID: number
	CallerLineNo: number
	CallCount: number
}

interface ICalledTo { // Section 3
	CalleeModuleID: number
	CallerLineNo: number
	CallCount: number
}

// Split module and child module?
export interface IModule { // Section 2
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
	executableLines: number
	executedLines: number
	coveragePct: number
	lineCount: number
	calledBy: ICalledBy[]
	calledTo: ICalledTo[]
	childModules: IModule[]
	lines: ILineSummary[]
	ISectionEight?: ISectionEight[]
	ISectionNine?: ISectionNine[]
	ISectionTen?: ISectionTen[]
	ISectionTwelve?: ISectionTwelve[]
}

export interface IProfileData {
	modules: IModule[]
	userData: IUserData[]
}

type IProps = Record<string, string>;

export class ABLProfileJson {
	version: number
	systemDate: string
	systemTime?: string
	description?: string
	userID?: string
	properties?: IProps
	// otherInfo: string
	// StmtCnt: string | undefined
	modules: IModule[] = []
	userData: IUserData[] = []
	testItemId?: string
	interpretedModuleSequence = 0
	parseDuration: Duration
	ignoredModules: number[] = [0]

	constructor (public readonly profileUri: Uri, lines: string[], public debugLines: ABLDebugLines, private readonly ignoreExternalCoverage: boolean) {
		this.parseDuration = new Duration('parse profile data: ' + profileUri)
		this.debugLines = debugLines
		if (lines.length > 1) {
			throw new Error('Invalid profile data - section 1 should have exactly one line (uri=' + this.profileUri.fsPath + ')')
		}
		const test = summaryRE.exec(lines[0])
		if(test) {
			this.version = Number(test[1])
			this.systemDate = test[2]
			this.systemTime = test[4]
			this.description = test[3]
			this.userID = test[5]
			this.properties = JSON.parse(test[6].replace(/\\/g, '/')) as IProps
		} else {
			throw new Error('Unable to parse profile data in section 1 (uri=' + this.profileUri.fsPath + ')')
		}
	}

	endParse () {
		this.parseDuration.stop()
	}

	isIgnored (sourceName: string) {
		if (!this.ignoreExternalCoverage) {
			return false
		}
		return sourceName.startsWith('OpenEdge.') ||
			sourceName.startsWith('Ccs.Common') ||
			sourceName.startsWith('VSCode.ABLUnit') ||
			sourceName.endsWith('ABLUnitCore.p')
	}

	async addModules (lines: string[]) {
		this.modules = []
		const childModules: IModule[] = []
		for(const element of lines) {
			let test = moduleRE.exec(element)
			if (!test) {
				test = moduleRE2.exec(element)
			}

			if (!test?.[2]) {
				throw new Error('Unable to parse module name - name is empty (uri=' + this.profileUri.fsPath + ')')
			}
			const moduleName = test[2]


			let sourceName = ''
			let parentName: string | undefined
			const destructor: boolean = moduleName.startsWith('~')
			const split = moduleName.split(' ')

			if (split.length >= 4) {
				throw new Error('Unable to parse module name - has 4 sections which is more than expected: ' + moduleName + ' (uri=' + this.profileUri.fsPath + ')')
			}

			let entityName = split[0]
			if (split.length == 1) {
				sourceName = split[0]
				entityName = '<main block>'
			} else {
				if (split[1]) {
					sourceName = split[1]
				}
				if (split[2]) {
					parentName = split[2]
				}
				if (split[3]) {
					log.warn('module has fourth section: ' + split[3] + ' (module.name=' + sourceName + ', uri=' + this.profileUri.fsPath + ')')
				}
			}

			if (this.isIgnored(sourceName)) {
				log.debug('ignoring module moduleId=' + test[1] + ', sourceName=' + sourceName + ', entityName=' + entityName)
				this.ignoredModules.push(Number(test[1]))
				continue
			}

			const fileinfo = await this.debugLines.propath.search(sourceName)
			const mod: IModule = {
				ModuleID: Number(test[1]),
				ModuleName: moduleName,
				EntityName: entityName,
				SourceName: sourceName,
				SourceUri: fileinfo?.uri,
				ParentName: parentName,
				ListingFile: test[3],
				CrcValue: Number(test[4]),
				ModuleLineNum: Number(test[5]),
				Destructor: destructor,
				UnknownString1: test[6],
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

			if (Number(test[4]) != 0) {
				this.modules.push(mod)
			} else {
				childModules.push(mod)
			}
		}
		this.addChildModulesToParents(childModules)
	}

	addChildModulesToParents (childModules: IModule[]) {
		for(const child of childModules) {
			let parent = this.modules.find(p => p.SourceUri === child.SourceUri)
			if (!parent) {
				parent = this.modules.find(p => p.SourceName === child.ParentName)
			}
			if (!parent) {
				this.interpretedModuleSequence--
				log.warn('Could not find parent module, creating interpre modude id ' + this.interpretedModuleSequence + ' for ' + child.SourceName + ' (uri=' + this.profileUri.fsPath + ')')
				parent = {
					ModuleID: this.interpretedModuleSequence,
					ModuleName: child.SourceName,
					EntityName: child.SourceName,
					SourceName: child.SourceName,
					SourceUri: child.SourceUri,
					CrcValue: 0,
					ModuleLineNum: 0,
					UnknownString1: '',
					executableLines: 0,
					executedLines: 0,
					coveragePct: 0,
					lineCount: 0,
					calledBy: [],
					calledTo: [],
					childModules: [],
					lines: []
				}
				this.modules.push(parent)
			}

			parent.childModules.push(child)
			if (parent.SourceName === child.SourceName) {
				parent.SourceName = child.SourceName
			}
		}
	}

	getModule (modID: number): IModule | undefined {
		for(const element of this.modules) {
			if(element.ModuleID === modID)
				return element
		}
		const parent = this.modules.find(mod => mod.childModules.find(child => child.ModuleID == modID))
		if(parent)
			return parent.childModules.find(child => child.ModuleID == modID)
	}

	getChildModule (modID: number, entityName: string): IModule | undefined {
		const parent = this.getModule(modID)
		if(parent) {
			return parent.childModules.find(child => child.EntityName == entityName)
		}
	}

	getModuleLine (modID: number, lineNo: number): ILineSummary | undefined {
		const mod = this.getModule(modID)
		if(mod) {
			for(const element of mod.lines) {
				if(element.LineNo === lineNo)
					return element
			}
		}
	}

	getLine (mod: IModule, lineNo: number): ILineSummary | undefined {
		for(const element of mod.lines) {
			if(element.LineNo == lineNo)
				return element
		}
	}

	addCallTree (lines: string[]) {
		for(const element of lines) {
			const test = callTreeRE.exec(element)

			if(test && test.length == 5) {
				// Called By
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

				// Called To
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
		for(const element of lines) {
			const test = lineSummaryRE.exec(element)
			if (!test) {
				continue
			}

			const modID = Number(test[1])
			if (this.ignoredModules.includes(modID)) {
				continue
			}

			const sourceName = this.getModule(modID)?.SourceName
			if (!sourceName) {
				log.warn('could not find source name for module ' + modID)
				continue
			}

			const sum = new LineSummary(Number(test[2]), true)
			sum.ExecCount = Number(test[3])
			sum.ActualTime = Number(test[4])
			sum.CumulativeTime = Number(test[5])


			const lineinfo = await this.debugLines.getSourceLine(sourceName, sum.LineNo)
			if(lineinfo) {
				sum.srcLine = lineinfo.debugLine
				sum.srcUri = lineinfo.debugUri
				sum.incLine = lineinfo.sourceLine
				sum.incUri = lineinfo.sourceUri
			} else {
				log.debug('could not find source/debug line info for ' + sourceName + ' ' + sum.LineNo)
			}

			const mod = this.getModule(modID)
			if (mod) {
				mod.lines.push(sum)
				if (sum.LineNo != 0) {
					mod.lineCount++
				}
			}
		}
	}

	addTracing (lines: string[]) {
		for(const element of lines) {
			const test = tracingRE.exec(element)
			if (test) {
				const modID = Number(test[1])
				const lineNo = Number(test[2])
				const trace = {
					StartTime: Number(test[4]),
					ActualTime: Number(test[3])
				}
				const line = this.getModuleLine(modID, lineNo)
				if (line) {
					if(! line.trace) line.trace = []
					line.trace[line.trace.length] = trace
				}

			}
		}
	}

	// //// https://community.progress.com/s/article/What-information-is-provided-by-PROFILER-COVERAGE-Method
	// //// Section format:
	// module-id "module-name" executable-lines
	// lineNo
	// lineNo
	// .
	// module-id "module-name" executable-lines
	// lineNo
	// .
	// .  (end of section)
	async addCoverage (lines: string[]) {
		lines.unshift('.')
		lines.push('.')
		let mod: IModule | undefined
		let ignoringCurrentModule: number | boolean = false
		let lastModuleLine: string | undefined = undefined

		try {
			for(let lineNo=1; lineNo < lines.length; lineNo++) {
				if (lines[lineNo] === '.') {
					// set info for the previous section
					if (mod) {
						mod.executableLines = mod.lines.filter(l => l.LineNo != 0 && l.Executable).length
						mod.executedLines = mod.lines.filter(l => l.LineNo != 0 && l.ExecCount > 0).length
						if (mod.executableLines > 0) {
							mod.coveragePct = mod.executedLines * 100 / mod.executableLines
						}
					}
					continue
				}
				if (lines[lineNo - 1] === '.') {
					// prepare the next section by finding the correct module
					try {
						ignoringCurrentModule = false
						mod = await this.addCoverageNextSection(lines[lineNo])
						lastModuleLine = lines[lineNo]
					} catch (err) {
						if (err instanceof ModuleIgnored) {
							ignoringCurrentModule = err.moduleId
						} else {
							log.warn('addCoverageNextSection returned undefined (lineNo=' + lineNo + ', uri=' + this.profileUri.fsPath + ')' +
							'\tlines[' + lineNo + ']=' + lines[lineNo])
						}

					}
					continue
				}

				if (ignoringCurrentModule) {
					continue
				}

				if(!mod) {
					log.warn('section 6 coverage data could not find module (uri=' + this.profileUri.fsPath + ')' +
						'\n\tlastModuleLine=' + lastModuleLine)
					continue
				}

				// add exec count to existing line
				const line = this.getLine(mod, Number(lines[lineNo]))
				if (line) {
					line.Executable = true
					mod.executableLines++
					continue
				}

				// create object for first encounter of this line num
				const sum: ILineSummary = {
					LineNo: Number(lines[lineNo]),
					ExecCount: 0,
					Executable: true,
					ActualTime: 0,
					CumulativeTime: 0,
				}

				if (mod.SourceUri) {
					const lineinfo = await this.debugLines.getSourceLine(mod.SourceUri.fsPath, lineNo)
					if (lineinfo) {
						sum.srcLine = lineinfo.debugLine
						sum.srcUri = lineinfo.debugUri
						sum.incLine = lineinfo.sourceLine
						sum.incUri = lineinfo.sourceUri
					}
				}

				mod.lines.push(sum)
			}
		} catch (error) {
			log.error('Error parsing coverage data in section 6 (module=' + mod?.ModuleName + ', uri=' + this.profileUri.fsPath + '):\n\terror=' + error)
		}
		this.assignParentCoverage()
	}

	async addCoverageNextSection (line: string) {
		const test = coverageRE.exec(line)
		if (!test) {
			log.error('Unable to parse coverage data in section 6 (uri=' + this.profileUri.fsPath + ')')
			throw new Error('Unable to parse coverage data in section 6 (uri=' + this.profileUri.fsPath + ')')
		}

		const modId = Number(test[1])
		if (this.ignoredModules.includes(modId)) {
			throw new ModuleIgnored(modId)
		}

		if (test[2] != '') {
			const mod = this.getChildModule(modId, test[2])
			if (mod) {
				mod.executableLines = Number(test[3])
				return mod
			}
		}

		const mod = this.getModule(Number(test[1])) ?? this.modules.find(mod => mod.SourceName == test[2])
		if (!mod) {
			log.warn('Unable to find module ' + test[1] + ' ' + test[2] + ' while processing coverage information from section 6 (' + this.profileUri.fsPath + ')')
			return
		}

		mod.executableLines += Number(test[3])

		if (test[2] != '') {
			const child: IModule = {
				ModuleID: Number(test[1]),
				ModuleName: test[2] + ' ' + mod.SourceName,
				EntityName: test[2],
				SourceName: mod.SourceName,
				CrcValue: 0,
				ModuleLineNum: 0,
				UnknownString1: '',
				executableLines: Number(test[3]),
				executedLines: 0,
				coveragePct: 0,
				lineCount: 0,
				calledBy: [],
				calledTo: [],
				childModules: [],
				lines: [],
			}
			if (child.SourceName) {
				const fileinfo = await this.debugLines.propath.search(child.SourceName)
				if (fileinfo?.uri) {
					child.SourceUri = fileinfo.uri
				}
			}
			mod.childModules.push(child)
			return child
		}
		return mod
	}

	assignParentCoverage () {
		for (const parent of this.modules) {
			for (const child of parent.childModules) {
				child.executableLines = child.lines.filter(l => l.LineNo > 0 && l.Executable).length
				child.executedLines = child.lines.filter(l => l.LineNo > 0 && l.ExecCount > 0).length
				parent.executableLines += child.executableLines
				parent.executedLines += child.executedLines
				child.lines.sort((a, b) => a.LineNo - b.LineNo)
				for (const line of child.lines) {
					if (line.LineNo == 0) {
						continue
					}
					const parentLine = parent.lines.find(l => l.LineNo == line.LineNo)
					const idx = parent.lines.findIndex(l => l.LineNo == line.LineNo)
					if(parentLine) {
						parentLine.ExecCount += line.ExecCount
						if (line.ActualTime) {
							if (!parentLine.ActualTime) parentLine.ActualTime = 0
							parentLine.ActualTime += line.ActualTime
						}
						if (line.CumulativeTime) {
							if (!parentLine.CumulativeTime) parentLine.CumulativeTime = 0
							parentLine.CumulativeTime += line.CumulativeTime
						}
						parent.lines[idx] = parentLine
					} else {
						parent.lines.push(line)
					}
				}
			}
			parent.childModules.sort((a, b) => a.ModuleID - b.ModuleID)
			parent.coveragePct = parent.executedLines / parent.executableLines * 100
			parent.lines.sort((a, b) => a.LineNo - b.LineNo)

			if (parent.lines.length > 0) {
				parent.lineCount = parent.lines[parent.lines.length - 1]?.LineNo ?? 0 // not totally accurate, but close
			}
		}
	}

	addSection7 (lines: string[]) {
		if (lines.length !== 0) {
			log.trace('section 7 not implemented.  line count = ' + lines.length)
		}
	}

	// //// https://docs.progress.com/bundle/abl-reference/page/STATISTICS-attribute.html
	// //// https://community.progress.com/s/article/What-s-the-PROFILER-STATISTICS-method
	// //// PROFILER:STATISTICS has 4 sections ()
	// 1. Operation Section
	// 2. Module Detail Section
	// 3. Sessions Watermark Section
	// 4. Parameter and Database Section

	// //// Examples:
	// 114 10036 4 "TY_ASGNODBFLD "
	// 114 37 15 "ECONST"
	// 114 58 2 "RETRY"
	addSection8 (lines: string[]) {
		// const sectRE = /&(\d+) (\d+) (-?\d+) (-?\d+) (\d+\.\d+) (.*)$/
		const sectRE = /^(\d+) (\d+) (\d+) "(.*)"/
		if (!lines.length) { return }
		for(let lineNo=0; lineNo < lines.length; lineNo++) {
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
					if (!mod.ISectionEight) mod.ISectionEight = []
					mod.ISectionEight.push(ISectionEight)
				} else {
					log.error('Unable to find module ' + ISectionEight.ModuleID + ' in section 8')
					log.error('  - line=\'' + lines[lineNo] + '\'')
				}
			} else {
				log.error('Unable to parse section 8 line ' + lineNo + ': ' + lines[lineNo])
				log.error('  - line=\'' + lines[lineNo] + '\'')
			}
		}
	}

	addSection9 (lines: string[]) {
		if (!lines.length) { return }
		const sectRE = /^(\d+) (.*)$/
		for(const element of lines) {
			const test = sectRE.exec(element)
			if (test) {
				const ISectionNine: ISectionNine = {
					ModuleID: Number(test[1]),
					fields: test[2].trim().split(' ').filter(f => f.length > 0)
				}
				const mod = this.getModule(ISectionNine.ModuleID)
				if (mod) {
					if (!mod.ISectionNine) mod.ISectionNine = []
					mod.ISectionNine.push(ISectionNine)
				} else {
					log.error('Unable to find module ' + ISectionNine.ModuleID + ' in section 9 (uri=' + this.profileUri.fsPath + ')')
					log.error('  - line=\'' + element + '\'')
				}
			}
		}
	}

	addSection10 (lines: string[]) {
		if (!lines.length) { return }
		const sectRE = /^(\d+) (.*)$/
		for(const element of lines) {
			const test = sectRE.exec(element)
			if (test) {
				const ISectionTen: ISectionTen = {
					ModuleID: Number(test[1]),
					remainder: test[2]
				}
				const mod = this.getModule(ISectionTen.ModuleID)
				if (mod) {
					if (!mod.ISectionTen) mod.ISectionTen = []
					mod.ISectionTen.push(ISectionTen)
				} else {
					log.error('Unable to find module ' + ISectionTen.ModuleID + ' in section 10 (uri=' + this.profileUri.fsPath + ')')
					log.error('  - line=\'' + element + '\'')
				}
			}
		}
	}

	addSection11 (lines: string[]) {
		log.error('section 11 not implemented.  line count = ' + lines.length)
	}

	addSection12 (lines: string[]) {
		const sectRE1 = /^(\d+) (\d+) (\d+) (\d+) (\d+) (\d+\.\d+) (.+)?$/
		const sectRE2 = /^(\d+) (\d+) (\d+) (\d+) (\d+) (\d+\.\d+)$/
		if (!lines.length) { return }
		for(const element of lines) {
			const test = sectRE1.exec(element) ?? sectRE2.exec(element)
			if (!test) { continue }

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
				if (!mod.ISectionTwelve) mod.ISectionTwelve = []
				mod.ISectionTwelve.push(ISectionTwelve)
			} else {
				// TODO
				if (ISectionTwelve.ModuleID != 0) {
					log.debug('Unable to find module ' + ISectionTwelve.ModuleID + ' in section 12 (line=' + element + ', uri=' + this.profileUri.fsPath + ')')
				}
			}
		}
	}

	addSection13 (lines: string[]) {
		log.error('section 13 not implemented.  line count = ' + lines.length)
	}

	addUserData (lines: string[]) {
		const userRE = /(\d+\.\d+) "(.*)"$/
		if (!lines.length) { return }
		for(const element of lines) {
			const test = userRE.exec(element)
			if (test) {
				this.userData.push({
					time: Number(test[1]),
					data: test[2]
				})
			} else {
				throw new Error('Unable to parse user data (uri=' + this.profileUri.fsPath + ')')
			}
		}
	}
}


export function getModuleRange (module: IModule) {
	const lines = module.lines.filter((a) => a.LineNo > 0)
	for (const child of module.childModules) {
		lines.push(...child.lines.filter((l) => l.LineNo > 0))
	}
	lines.sort((a, b) => { return a.LineNo - b.LineNo })

	if (lines.length == 0) {
		return undefined
	}

	const start = new Position(lines[0].LineNo - 1, 0)
	const end = new Position(lines[lines.length - 1].LineNo - 1, 0)
	return new Range(start, end)
}

export function getDeclarationCoverage (module: IModule) {
	const fdc: DeclarationCoverage[] = []

	const range = getModuleRange(module)
	if (range) {
		const zeroLine = module.lines.find((a) => a.LineNo == 0)
		fdc.push(new DeclarationCoverage(module.EntityName ?? '<main block>', zeroLine?.ExecCount ?? 0, range))
	}
	for (const child of module.childModules) {
		const childRange = getModuleRange(child)
		if (childRange) {
			const zeroLine = child.lines.find((a) => a.LineNo == 0)
			fdc.push(new DeclarationCoverage(child.EntityName ?? '<main block>', zeroLine?.ExecCount ?? 0, childRange))
		}
	}
	return fdc
}
