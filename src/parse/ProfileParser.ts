import { DeclarationCoverage, Position, Range, StatementCoverage, TextDocument, Uri, workspace } from 'vscode'
import { PropathParser } from 'ABLPropath'
import { ABLDebugLines } from 'ABLDebugLines'
import { log } from 'ChannelLogger'
import * as FileUtils from 'FileUtils'
import { Duration } from 'ABLUnitCommon'
import { ProfileData } from 'parse/ProfileData'

class ModuleIgnored extends Error {
	constructor (public moduleId: number) {
		super('module ignored: ' + moduleId)
		this.name = 'ModuleIgnored'
	}
}

export class ABLProfile {
	profJSON?: ABLProfileJson
	parseAll = false

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
		let currentSection: number = 0
		sectionLines[currentSection] = []
		currentSection++
		sectionLines[currentSection] = []

		for (let lineNo = 0; lineNo < lines.length; lineNo++) {
			if(lines[lineNo] === '.' && (currentSection != 6 || lines[lineNo + 1] === '.')) {
				currentSection++
				sectionLines[currentSection] = []
			} else {
				sectionLines[currentSection].push(lines[lineNo])
			}
		}

		log.debug('section1 ' + sectionLines[1].length)
		this.profJSON = new ABLProfileJson(uri, sectionLines[1], debugLines, ignoreExternalCoverage)
		log.debug('section2 ' + sectionLines[2].length)
		this.profJSON.addModules(sectionLines[2])
		if (this.profJSON.modules.length > 0) { // all modules excluded
			await this.profJSON.addSourceMap()
			log.debug('section3 ' + sectionLines[3].length)
			this.profJSON.addCallTree(sectionLines[3])
			log.debug('section4 ' + sectionLines[4].length)
			this.profJSON.addLineSummary(sectionLines[4])
			log.debug('section5 ' + sectionLines[5].length)
			this.profJSON.addTracing(sectionLines[5])

			if (sectionLines.length > 6) {

				if (sectionLines[6].length > 0) {
					log.debug('section6 ' + sectionLines[6].length)
					this.profJSON.addCoverage(sectionLines[6])
				}

				if (this.parseAll && sectionLines.length > 7) {
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
						log.debug('section13 ' + sectionLines[13].length + ' (User Data)')
						this.profJSON.addUserData(sectionLines[13])
					} else {
						log.debug('section12 ' + sectionLines[8].length)
						this.profJSON.addSection12(sectionLines[8])
						log.debug('section13 ' + sectionLines[9].length + ' (User Data)')
						this.profJSON.addUserData(sectionLines[9])
					}
				}
			}
		}

		this.profJSON.modules.sort((a, b) => a.ModuleID - b.ModuleID)
		for (const m of [...this.profJSON.modules, ...this.profJSON.modules.flatMap(m => m.childModules)]) {
			const incUri = m.lines.find(l => l.LineNo != 0 && l.incUri)?.incUri
			if (incUri && m.lines.filter(l => l.LineNo != 0).every(l => l.incUri?.fsPath == incUri.fsPath)) {
				m.incUri = incUri
			}
		}

		if (writeJson) {
			const jsonUri = Uri.file(uri.fsPath.replace(/\.[a-zA-Z]+$/, '.json'))
			// eslint-disable-next-line promise/catch-or-return
			this.writeJsonToFile(jsonUri).then(() => {
				return true
			}, (e: unknown) => {
				log.error('Error writing profiler output json file: ' + e)
				return false
			})
		}
		log.debug('parseData returning')
		this.profJSON.endParse(uri)
		return this.profJSON
	}

	writeJsonToFile (uri: Uri) {
		const data = new ProfileData(JSON.stringify({
			modules: this.profJSON!.modules,
			userData: this.profJSON!.userData,
		}))
		return workspace.fs.writeFile(uri, Uint8Array.from(Buffer.from(JSON.stringify(data, null, 2)))).then(() => {
			log.info('wrote profiler output json file: ' + workspace.asRelativePath(uri))
			return
		}, (e: unknown) => {
			log.error('failed to write profiler output json file ' + workspace.asRelativePath(uri) + ' - ' + e)
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

export interface IModule { // Section 2
	ModuleID: number
	ModuleName: string
	EntityName?: string // function/procedure/method name
	SourceUri: Uri
	SourceName: string // source file
	ParentModuleID?: number
	ParentName?: string
	Destructor?: boolean
	ListingFile?: string
	CrcValue: number
	ModuleLineNum: number
	UnknownString1: string
	procNum?: number
	overloaded?: boolean
	overloadSequence?: number
	execCount?: number
	actualTime?: number,
	cumulativeTime?: number
	executableLines: number
	executedLines: number
	coveragePct: number
	lineCount: number
	calledBy: ICalledBy[]
	calledTo: ICalledTo[]
	childModules: IModule[]
	lines: LineSummary[]
	ISectionEight?: ISectionEight[]
	ISectionNine?: ISectionNine[]
	ISectionTen?: ISectionTen[]
	ISectionTwelve?: ISectionTwelve[]
	incUri?: Uri
}

// Split module and child module?
export interface IModule2 { // Section 2
	ModuleID: number
	ModuleName: string
	SourceUri: Uri
	SourceName: string // source file
	UnknownString1: string
	executableLines: number
	executedLines: number
	coveragePct: number
	lineCount: number
	calledBy: ICalledBy[]
	calledTo: ICalledTo[]
	lines: LineSummary[]
	ISectionEight?: ISectionEight[]
	ISectionNine?: ISectionNine[]
	ISectionTen?: ISectionTen[]
	ISectionTwelve?: ISectionTwelve[]
}

export interface IChildModule extends IModule2 {
	parentId: number
	ParentName: string
	EntityName?: string // function/procedure/method name
	Destructor?: boolean
	ModuleLineNum: number
	overloaded?: boolean
	overloadSequence?: number
}

export interface IParentModule extends IModule2 {
	CrcValue: number
	ListingFile?: string
	childModules: IChildModule[]
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

interface ITrace { // Section 5
	StartTime: number,
	ActualTime: number
}

class LineSummary { // Section 6}
	ActualTime?: number
	CumulativeTime?: number
	trace?: ITrace[]
	srcLine?: number
	srcUri?: Uri
	incLine?: number
	incUri?: Uri
	procNum?: number

	constructor (private readonly sourceName: string, public readonly LineNo: number, public Executable: boolean, public ExecCount: number, public sourcePath: string) {
	}

}

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

interface ISectionTen { // Section 10
	ModuleID: number,
	remainder: string
}

interface ISectionTwelve { // Section 11
	ModuleID: number,
	field1: number,
	field2: number,
	field4: number,
	field5: number,
	field6: number,
	remainder: string
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
	modules: IModule[] = []
	userData: IUserData[] = []
	interpretedModuleSequence = 0
	parseDuration: Duration
	ignoredModules: number[] = [0]
	private hasSourceMap = false

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

	endParse (uri: Uri) {
		this.parseDuration.stop()
		log.info('parsed profiler output file ' + uri.fsPath + ' in ' + this.parseDuration.elapsed() + 'ms (modules.length=' + this.modules.length + ')')
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

	addModules (lines: string[]) {
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

			const fileinfo = this.debugLines.propath.search(sourceName)
			if (!fileinfo?.uri) {
				log.debug('could not find source file in propath for ' + sourceName + ' (uri=' + this.profileUri.fsPath + ')')
				continue
			}
			const mod: IModule = {
				ModuleID: Number(test[1]),
				ModuleName: moduleName,
				EntityName: entityName,
				SourceName: sourceName,
				SourceUri: fileinfo.uri,
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

	async addSourceMap () {
		for (const mod of this.modules) {
			const map = await this.debugLines.getSourceMap(mod.SourceUri)
			if (!map) {
				log.warn('could not parse source map for ' + mod.SourceUri.fsPath)
				// could not parse source map :(
				return
			}
			this.hasSourceMap = true
			for (const item of map.items) {
				if (item.procName == '') {
					// parent module
					const l = mod.lines.find(l => l.LineNo == item.debugLine)
					if (l) {
						// update existing line on parent module
						l.Executable = true
						l.srcUri = item.debugUri
						l.srcLine = item.debugLine
						l.incUri = item.sourceUri
						l.incLine = item.sourceLine
						l.procNum = item.procNum
						continue
					}
					// add new line to parent module
					const newLine = new LineSummary(mod.SourceUri.fsPath, item.debugLine, true, 0, item.sourcePath)
					newLine.srcUri = item.debugUri
					newLine.srcLine = item.debugLine
					newLine.incUri = item.sourceUri
					newLine.incLine = item.sourceLine
					newLine.procNum = item.procNum
					mod.lines.push(newLine)
					continue
				} else {
					// child module
					let children = mod.childModules.filter(m => m.EntityName == item.procName)

					if (children.length > 1) {
						let seq = 1
						for (const c of children) {
							c.overloaded = true
							c.overloadSequence = seq
							seq++
						}
					}

					if (!children || children.length == 0) {
						// add new child module - won't have any coverage
						mod.childModules.push({
							ModuleID: mod.ModuleID,
							ModuleName: item.procName + ' ' + mod.ModuleName,
							EntityName: item.procName,
							SourceUri: item.debugUri,
							SourceName: mod.SourceName,
							ParentModuleID: mod.ModuleID,
							ParentName: mod.ParentName,
							Destructor: item.procName.startsWith('~'),
							CrcValue: map.crc ?? 0,
							ModuleLineNum: item.debugLine, // not exactly accurate, but as close as we're going to get
							UnknownString1: '',
							procNum: item.procNum,
							executableLines: 1,
							executedLines: 0,
							coveragePct: 0,
							lineCount: 0,
							calledBy: [],
							calledTo: [],
							childModules: [],
							lines: [],
							ISectionEight: [],
							ISectionNine: [],
							ISectionTen: [],
							ISectionTwelve: []
						})
						children = [mod.childModules[mod.childModules.length - 1]]
					}

					// add or update line on existing child
					if (children.length >= 1) {
						let child = children.find(m => m.procNum == item.procNum)
						if (!child) {
							child = children.find(m => !m.procNum)
							if (child) {
								child.procNum = item.procNum
							}
						}
						if (!child) {
							const modNum = children[0].ModuleID
							const maxSeq = Math.max(...children.map(c => c.overloadSequence ?? 0)) + 1
							mod.childModules.push({
								ModuleID: modNum,
								ModuleName: item.procName + ' ' + mod.ModuleName,
								EntityName: item.procName,
								SourceUri: item.debugUri,
								SourceName: mod.SourceName,
								ParentModuleID: mod.ModuleID,
								ParentName: mod.ParentName,
								Destructor: item.procName.startsWith('~'),
								CrcValue: map.crc ?? 0,
								ModuleLineNum: item.debugLine, // not exactly accurate, but as close as we're going to get
								UnknownString1: '',
								procNum: item.procNum,
								overloaded: true,
								overloadSequence: maxSeq,
								executableLines: 1,
								executedLines: 0,
								coveragePct: 0,
								lineCount: 0,
								calledBy: [],
								calledTo: [],
								childModules: [],
								lines: [],
								ISectionEight: [],
								ISectionNine: [],
								ISectionTen: [],
								ISectionTwelve: []

							})
							child = mod.childModules[mod.childModules.length - 1]
						}
						const l = child.lines.find(l => l.LineNo == item.debugLine)
						if (l) {
							// update existing line
							l.Executable = true
							l.srcUri = item.debugUri
							l.srcLine = item.debugLine
							l.sourcePath = item.sourcePath
							l.incUri = item.sourceUri
							l.incLine = item.sourceLine
							l.procNum = item.procNum
							continue
						}
						// add new line
						const newLine = new LineSummary(mod.SourceUri.fsPath, item.debugLine, true, 0, item.sourcePath)
						newLine.srcUri = item.debugUri
						newLine.srcLine = item.debugLine
						newLine.incUri = item.sourceUri
						newLine.incLine = item.sourceLine
						newLine.procNum = item.procNum
						child.lines.push(newLine)
						continue
					}

				}
				throw new Error('could not find module to add source map item from ' + item.debugUri + ' (uri=' + this.profileUri.fsPath + ')\n\titem=' + JSON.stringify(item))
			}
		}
	}

	addChildModulesToParents (childModules: IModule[]) {
		for(const child of childModules) {
			let parent = this.modules.find(p => p.SourceUri.fsPath === child.SourceUri.fsPath)
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

	getModules (modID: number): IModule[] {
		return this.modules.flatMap(mod => [mod, ...mod.childModules]).filter(mod => mod.ModuleID === modID) ?? []
	}

	getParentModule (moduleID: number): IModule | undefined {
		return this.modules.find(p => p.ModuleID == moduleID)
	}

	getChildModules (modID: number, entityName: string): IModule[] {
		const parent = this.modules.find(m => m.ModuleID == modID)
		if(parent) {
			return parent.childModules.filter(child => child.EntityName == entityName) ?? []
		}
		return []
	}

	getModuleLine (modID: number, lineNo: number): LineSummary | undefined {
		const mods = this.getModules(modID)
		for (const m of mods) {
			for(const l of m.lines) {
				if(l.LineNo === lineNo)
					return l
			}
		}
		return undefined
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
				const mods = this.getModules(cbModID)
				for (const mod of mods) {
					if (mod?.calledBy != undefined) {
						mod.calledBy[mod.calledBy.length] = cb
					}
				}

				// Called To
				const ctModID = Number(test[1])
				const ct = {
					CalleeModuleID: Number(test[3]),
					CallerLineNo: Number(test[2]),
					CallCount: Number(test[4])
				}

				const toMods = this.getModules(ctModID)
				for (const m of toMods) {
					if (m.calledTo != undefined) {
						m.calledTo[m.calledTo.length] = ct
					}
				}
			}
		}
	}

	addLineSummary (lines: string[]) {
		for(const element of lines) {
			const test = lineSummaryRE.exec(element)
			if (!test) {
				continue
			}

			const modID = Number(test[1])
			if (this.ignoredModules.includes(modID)) {
				continue
			}

			const mods = this.getModules(modID)

			if (mods.length > 0) {
				if (Number(test[2]) != 0) {
					mods[0].lineCount++
				} else {
					mods[0].execCount = Number(test[3])
					mods[0].actualTime = Number(test[4])
					mods[0].cumulativeTime = Number(test[5])
				}
			}

			const mod = mods.find(m => m.lines.find(l => l.LineNo == Number(test[2])))
			if (!mod) {
				log.debug('could not find module ' + modID + ' with line ' + test[2] + ' (uri=' + this.profileUri.fsPath + ')')
				continue
			}

			const line = mod.lines.find(l => l.LineNo == Number(test[2]))
			if (line) {
				// update existing line
				line.ExecCount += Number(test[3])
				if (!line.ActualTime) {
					line.ActualTime = 0
				}
				if (!line.CumulativeTime) {
					line.CumulativeTime = 0
				}
				line.ActualTime += Number(test[4])
				line.CumulativeTime += Number(test[5])
				continue
			}

			const sum = new LineSummary(mod.SourceUri?.fsPath ?? mod.SourceName, Number(test[2]), false, Number(test[3]), 'UNKNOWN')
			sum.ActualTime = Number(test[4])
			sum.CumulativeTime = Number(test[5])

			mod.lines.push(sum)

		}

		// summarize execution
		for (const mod of this.modules) {
			mod.executableLines = 0
			mod.executedLines = 0
			mod.coveragePct = 0
			for (const child of mod.childModules) {
				child.executableLines = child.lines.filter(l => l.LineNo != 0 && l.Executable).length
				child.executedLines = child.lines.filter(l => l.LineNo != 0 && l.ExecCount > 0).length
				child.coveragePct = child.executedLines * 100 / child.executableLines
				mod.executableLines += child.executableLines
				mod.executedLines += child.executedLines
			}
			mod.coveragePct = mod.executedLines * 100 / mod.executableLines
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
	addCoverage (lines: string[]) {
		if (this.hasSourceMap) {
			return
		}

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
						mod = this.addCoverageNextSection(lines[lineNo], Number(lines[lineNo + 1]))
						lastModuleLine = lines[lineNo]
					} catch (err) {
						if (err instanceof ModuleIgnored) {
							ignoringCurrentModule = err.moduleId
						} else {
							log.warn('addCoverageNextSection returned undefined (lineNo=' + lineNo + ', uri=' + this.profileUri.fsPath + ')' +
							'\\ntlines[' + lineNo + ']="' + lines[lineNo] + '"')
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
				const line = mod.lines.find(l => l.LineNo == Number(lines[lineNo]))
				if (line) {
					line.Executable = true
					mod.executableLines++
					continue
				}

				if (mod.overloaded && mod.ModuleLineNum == -1) {
					mod.ModuleLineNum = Number(lines[lineNo])
				}

				// create object for first encounter of this line num
				const sum = new LineSummary(mod.SourceUri?.fsPath ?? mod.SourceName, Number(lines[lineNo]), true, 0, 'UNKNWON2')
				mod.lines.push(sum)
			}
		} catch (error) {
			log.error('Error parsing coverage data in section 6 (module=' + mod?.ModuleName + ', uri=' + this.profileUri.fsPath + '):\n\terror=' + error)
		}
		this.assignParentCoverage()
	}

	addCoverageNextSection (line: string, firstLine: number) {
		const test = coverageRE.exec(line)
		if (!test) {
			log.error('Unable to parse coverage data in section 6 (uri=' + this.profileUri.fsPath + ')')
			throw new Error('Unable to parse coverage data in section 6 (uri=' + this.profileUri.fsPath + ')')
		}

		const modID = Number(test[1])
		const modName = test[2]
		const executableLines = Number(test[3])
		if (this.ignoredModules.includes(modID)) {
			throw new ModuleIgnored(modID)
		}

		if (modName != '') {
			const mods = this.getChildModules(modID, modName)
			if (mods.length > 0) {

				if (mods.length == 1 && mods[0].lines.find(l => l.LineNo == firstLine && l.Executable)) {
					// It appears 12.2 has some condition where it outputs the coverage for a given file mulutiple times
					return mods[0]
				}

				let mod = mods.find((m) => m.lines.find(l => l.LineNo == firstLine))
				if (!mod) {
					mod = mods.find((m) => m.EntityName == modName)
				}
				if (!mod) {
					throw new Error('could not find module for module ID=' + modID + ' modName=' + modName)
				}
				return mod
			}
		}

		const mod = this.getModules(modID).find(m => m.EntityName == modName) ?? this.modules.find(mod => mod.SourceName == modName)
		if (!mod) {
			log.warn('Unable to find module ' + modID + ' ' + modName + ' while processing coverage information from section 6 (' + this.profileUri.fsPath + ')')
			return
		}

		mod.executableLines += executableLines

		if (modName != '') {
			const child: IModule = {
				ModuleID: modID,
				ModuleName: modName + ' ' + mod.SourceName,
				EntityName: modName,
				SourceName: mod.SourceName,
				SourceUri: mod.SourceUri,
				CrcValue: 0,
				ModuleLineNum: 0,
				UnknownString1: '',
				executableLines: executableLines,
				executedLines: 0,
				coveragePct: 0,
				lineCount: 0,
				calledBy: [],
				calledTo: [],
				childModules: [],
				lines: [],
			}
			if (child.SourceName) {
				const fileinfo = this.debugLines.propath.search(child.SourceName)
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
				const mod = this.getModules(ISectionEight.ModuleID).find(m => m.ModuleID == ISectionEight.ModuleID)
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
				const mod = this.getModules(ISectionNine.ModuleID).find(m => m.ModuleID == ISectionNine.ModuleID)
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
				const mod = this.getModules(ISectionTen.ModuleID).find(m => m.ModuleID == ISectionTen.ModuleID)
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
			const mod = this.getModules(ISectionTwelve.ModuleID).find(m => m.ModuleID == ISectionTwelve.ModuleID)
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

function getLineRange (line: ILineSummary, shift = 0) {
	try {
		const lineno = (line.incLine ?? line.srcLine ?? 0) + shift
		if (!lineno || lineno < 0) {
			return undefined
		}
		let doc: TextDocument | FileUtils.TextDocumentLines | undefined = workspace.textDocuments.find((doc) => doc.uri.fsPath == line.incUri?.fsPath)
		if (!doc) {
			doc = FileUtils.openTextDocument(line.incUri ?? line.srcUri)
		}
		if (!doc) {
			log.error('could not find document for uri=' + line.incUri?.fsPath)
			throw new Error('could not find document for uri=' + line.incUri?.fsPath)
		}

		const l = doc.lineAt(lineno - 1)
		if (!l) {
			log.error('line not found in document (uri=' + line.incUri?.fsPath + ', lineno=' + lineno + ')')
			throw new Error('line not found in document (uri=' + line.incUri?.fsPath + ', lineno=' + lineno + ')')
		}
		const start = new Position(lineno - 1, l.firstNonWhitespaceCharacterIndex)
		const t = l.text.replace(/\/\/.*/, '').trimEnd()
		const end = new Position(lineno - 1, Math.max(t.length, 0))
		return new Range(start, end)
	} catch (e: unknown) {
		log.error('Error getting line range for line (uri=' + line.incUri?.fsPath + ', e=' + e)
		return undefined
	}
}

export function getStatementCoverage (lines: ILineSummary[], onlyUri?: Uri) {
	const sc: StatementCoverage[] = []
	for (const line of lines) {
		if (onlyUri && onlyUri.fsPath != line.incUri?.fsPath) {
			continue
		}
		if (line.LineNo == 0) {
			continue
		}
		const coverageRange = getLineRange(line)
		if (!coverageRange) {
			continue
		}
		sc.push(new StatementCoverage(line.ExecCount, coverageRange))
	}
	return sc
}

function getModuleRange (module: IModule, onlyUri: Uri) {
	const lines = module.lines.filter((l) => l.LineNo > 0 && (l.incUri?.fsPath ?? l.srcUri?.fsPath) == onlyUri.fsPath)
	lines.sort((a, b) => a.LineNo - b.LineNo)

	if (lines.length == 0) {
		return undefined
	}


	let firstLine

	if (module.ModuleLineNum && !module.overloaded && lines[0].LineNo != module.ModuleLineNum && lines[0].incLine) {
		firstLine = new Range(module.ModuleLineNum - (lines[0].LineNo - lines[0].incLine) - 1, 0, module.ModuleLineNum - (lines[0].LineNo - lines[0].incLine), 0)
	} else {
		let firstRange = getLineRange(lines[0])
		if (firstRange?.start.character != 0) {
			// start on char zero if the text starts anywhere that isn't char zero
			firstLine = firstRange?.with({ start: firstRange.start.with({ character: 0 }) })
		} else {
			// instead of char 0, which has a non whitepsace character, start on the end of the previous line
			firstRange = getLineRange(lines[0], -1)
			firstLine = firstRange?.with({start: firstRange.start.with({ character: firstRange.end.character })})
		}
	}

	const lastLine = getLineRange(lines[lines.length - 1])
	if (firstLine && lastLine) {
		// this should be the return value in all cases, theoretically
		return firstLine.union(lastLine)
	}

	const startLine = lines[0].incLine ?? lines[0].srcLine ?? lines[0].LineNo
	const start = new Position(startLine - 1, 0)
	const endLine = lines[lines.length - 1].incLine ?? lines[lines.length - 1].srcLine ?? lines[lines.length - 1].LineNo
	if (!endLine || endLine <=0) {
		return undefined
	}
	const end = new Position(endLine - 1, 0)
	return new Range(start, end)
}

export function getDeclarationCoverage (module: IModule, onlyUri: Uri) {
	const fdc: DeclarationCoverage[] = []
	const modules = [...module.childModules]

	for (const mod of modules) {
		if (onlyUri) {
			if (mod.incUri) {
				if (mod.incUri.fsPath != onlyUri.fsPath) {
					continue
				}
			} else if (mod.SourceUri.fsPath != onlyUri.fsPath) {
				continue
			}
		}

		const range = getModuleRange(mod, onlyUri)
		if (range) {
			let name = mod.EntityName ?? '<main block>'
			if (mod.overloaded) {
				name = name + ' (overload ' + mod.overloadSequence + ')'
			}

			let executed: boolean | number = mod.execCount ?? 0
			if (mod.overloaded) {
				const zeroLine = mod.lines.find(l => l.LineNo == 0)
				if (zeroLine) {
					executed = zeroLine.ExecCount
				} else {
					executed = mod.lines.find(l => l.ExecCount > 0) != undefined
				}
			}
			if (executed === false) {
				executed = 0
			}
			fdc.push(new DeclarationCoverage(name, executed, range))
		}
	}
	return fdc
}
