import { RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode'
import { log } from 'ChannelLogger'
import * as FileUtils from 'FileUtils'
import * as path from 'path'
import { readOEVersionFile } from 'ABLUnitCommon'

interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

interface IOEProfile {
	name: string
	inherits: string
	value: IOpenEdgeConfig
}

interface IOERuntime {
	name: string
	path: string
	pathExists: boolean
	default: boolean
}

interface IProcedure {
	name: string
	mode: string
}

interface IOpenEdgeConfig {
	// Content of a profile section in openedge-project.json
	oeversion?: string
	numThreads: number
	graphicalMode: boolean
	extraParameters?: string
	charset?: string
	buildPath?: IBuildPathEntry[]
	buildDirectory: string
	dbConnections: IDatabaseConnection[]
	procedures: IProcedure[]
	rootUri: Uri
}

interface IOpenEdgeMainConfig extends IOpenEdgeConfig {
	// JSON mapping of openedge-project.json
	modifiedTime: Date
	name: string
	version: string
	profiles?: IOEProfile[]
}

export interface IDlc {
	uri: Uri,
	version?: string
}

export interface IProjectJson {
	propathEntry: IBuildPathEntry[]
}

export interface IDatabaseConnection {
	name: string
	dumpFile: string
	schemaFile: string
	connect: string
	aliases: string[]
}

export interface IBuildPathEntry {
	type: 'source' | 'propath'
	path: string
	pathUri: Uri
	build: string
	xref: string
	excludes?: string
	excludesFile?: string
	includes?: string
	includesFile?: string
	documentation?: string
	deployment?: string
}

let oeRuntimes: IOERuntime[] = []
const dlcMap = new Map<WorkspaceFolder, IDlc>()

function getProjectJson (workspaceFolder: WorkspaceFolder) {
	const data = JSON.stringify(FileUtils.readStrippedJsonFile(Uri.joinPath(workspaceFolder.uri, 'openedge-project.json')))
	return data
}

export function getDLC (workspaceFolder: WorkspaceFolder, openedgeProjectProfile?: string, projectJson?: string) {
	log.info('[getDlc] workspaceFolder=' + workspaceFolder.name + ', openedgeProjectProfile=' + openedgeProjectProfile + ', projectJson=' + projectJson)
	const dlc = dlcMap.get(workspaceFolder)
	log.info('900 dlc.uri=' + dlc?.uri)
	if (dlc) {
		try {
			FileUtils.validateDirectory(dlc.uri)
			return dlc
		} catch (e: unknown) {
			log.warn('dlc not found: ' + dlc.uri + ' (e=' + e + ')')
		}
	}

	let runtimeDlc: Uri | undefined = undefined
	const oeversion = getOEVersion(workspaceFolder, openedgeProjectProfile, projectJson)
	const runtimes: IRuntime[] = workspace.getConfiguration('abl.configuration').get('runtimes', [])

	for (const runtime of runtimes) {
		if (runtime.name === oeversion) {
			runtimeDlc = Uri.file(runtime.path)
			break
		}
		if (runtime.default) {
			runtimeDlc = Uri.file(runtime.path)
		}
	}
	if (!runtimeDlc && process.env['DLC']) {
		runtimeDlc = Uri.file(process.env['DLC'])
	}
	if (runtimeDlc) {
		log.info('using DLC = ' + runtimeDlc.fsPath)
		const oeVer = readOEVersionFile(runtimeDlc.fsPath)
		const dlcObj: IDlc = {
			uri: runtimeDlc,
			version: oeVer,
		}
		dlcMap.set(workspaceFolder, dlcObj)

		FileUtils.validateDirectory(dlcObj.uri)
		return dlcObj
	}
	throw new Error('unable to determine DLC')
}

function getDlcDirectory (version: string | undefined): string {
	let dlc = ''
	let dfltDlc = ''
	let dfltName = ''
	oeRuntimes.forEach(runtime => {
		if (runtime.name === version) {
			dlc = runtime.path
		}
		if (runtime.default) {
			dfltDlc = runtime.path
			dfltName = runtime.name
		}
		runtime.pathExists = FileUtils.doesFileExist(Uri.file(runtime.path))
	})

	if (dlc === '' && oeRuntimes.length === 1) {
		dlc = oeRuntimes[0].path
	}

	if (dlc === '') {
		dlc = process.env['DLC'] ?? ''
	}

	if (dlc === '' && dfltDlc != '') {
		dlc = dfltDlc
		log.info('OpenEdge version not configured in workspace settings, using default version (' + dfltName + ') in user settings.')
	}
	return dlc
}

export function getOEVersion (workspaceFolder: WorkspaceFolder, openedgeProjectProfile?: string, projectJson?: string) {
	const profileJson = getOpenEdgeProfileConfig(workspaceFolder.uri, openedgeProjectProfile)
	if (!profileJson) {
		log.debug('profileJson not found')
		return undefined
	}

	if (profileJson.oeversion) {
		log.debug('profileJson.value.oeversion = ' + profileJson.oeversion)
		return profileJson.oeversion
	}

	if (!projectJson) {
		projectJson = getProjectJson(workspaceFolder)
		if (!projectJson) {
			return undefined
		}
	}
	if(projectJson) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const ver: string = JSON.parse(projectJson).oeversion
		if(ver) {
			log.debug('projectJson.oeversion = ' + ver)
			return ver
		}
	}
	return undefined
}

export class ProfileConfig implements IOpenEdgeConfig {
	name?: string
	version?: string
	dlc = ''
	propath: string[] = []
	// IOpenEdgeConfig properties
	oeversion?: string
	numThreads = 1 // unused
	graphicalMode = false // unused
	extraParameters?: string
	charset?: string
	buildPath: IBuildPathEntry[] = []
	buildDirectory = '.'
	dbConnections: IDatabaseConnection[] = []
	procedures: IProcedure[] = []

	startupProc?: string
	parameterFiles: string[] = []
	dbDictionary: string[] = []

	constructor (public readonly rootUri: Uri) {}

	public overwriteValues (parent: ProfileConfig | undefined) {
		if (!parent) return

		if (!this.oeversion) {
			this.oeversion = parent.oeversion
			this.dlc = parent.dlc
		}
		this.extraParameters = this.extraParameters ?? parent.extraParameters
		this.charset = this.charset ?? parent.charset
		if (!this.graphicalMode) {
			this.graphicalMode = parent.graphicalMode
		}
		if (!this.buildDirectory) {
			this.buildDirectory = parent.buildDirectory
		}
		if (this.buildPath.length == 0 && parent.buildPath) {
			this.buildPath = parent.buildPath
		}
		if (this.propath.length == 0 && parent.propath) {
			this.propath = parent.propath
		}
		if (this.dbConnections.length == 0 && parent.dbConnections) {
			this.dbConnections = parent.dbConnections
		}
		if (this.procedures.length == 0 && parent.procedures) {
			this.procedures = parent.procedures
		}
	}

	getTTYExecutable (): string {
		const dlcUri = Uri.file(this.dlc)
		if (FileUtils.doesFileExist(Uri.joinPath(dlcUri, 'bin', '_progres.exe')))
			return path.join(this.dlc, 'bin', '_progres.exe')
		else
			return path.join(this.dlc, 'bin', '_progres')
	}

	getExecutable (graphicalMode?: boolean): string {

		const dlcUri = Uri.file(this.dlc)
		const execs = [
			Uri.joinPath(dlcUri, 'bin', 'prowin.exe'),
			Uri.joinPath(dlcUri, 'bin', 'prowin32.exe'),
			Uri.joinPath(dlcUri, 'bin', '_progres.exe'),
			Uri.joinPath(dlcUri, 'bin', '_progres')
		]
		for (const p of execs) {
			if (!graphicalMode && !this.graphicalMode && p.fsPath.includes('prowin')) {
				continue
			}
			if (FileUtils.doesFileExist(p)) {
				return p.fsPath
			}
		}
		throw new Error('Unable to find OpenEdge executable in hierarchy:\n' + execs.join('\n - '))
	}

}

class OpenEdgeProjectConfig extends ProfileConfig {
	activeProfile?: string
	// @deprecate('Use rootUri instead of rootDir')
	public readonly rootDir: string
	profiles: Map<string, ProfileConfig> = new Map<string, ProfileConfig>()

	constructor (workspace: WorkspaceFolder | Uri) {
		super(workspace instanceof Uri ? workspace : workspace.uri)
		this.rootDir = this.rootUri.fsPath
	}
}

export function getActiveProfile (rootDir: string) {
	const uri = Uri.joinPath(Uri.file(rootDir), '.vscode', 'profile.json')
	if (FileUtils.doesFileExist(uri)) {
		const raw = FileUtils.readFileSync(uri)
		const contents = raw.toString().replace(/\r/g, '')
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const txt = JSON.parse(contents)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if (typeof txt.profile === 'string') {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const actProf = txt.profile as string
			return actProf
		}
		return undefined
	}
	return 'default'
}

const configMap = new Map<string, IOpenEdgeMainConfig>()

function loadConfigFile (uri: Uri): IOpenEdgeMainConfig | undefined {
	if (!FileUtils.doesFileExist(uri)) {
		log.info('No OpenEdge project config file found in ' + uri.fsPath + ', using default values')
		return undefined
	}

	const cachedConfig = configMap.get(uri.fsPath)
	const configModifiedTime = FileUtils.getFileModifiedTime(uri)
	if (cachedConfig && cachedConfig.modifiedTime.valueOf() === configModifiedTime.valueOf()) {
		log.debug('found cached OpenEdge project config for ' + uri.fsPath)
		return cachedConfig
	}

	try {
		log.info('reading OpenEdge project config file: ' + uri.fsPath)
		const data = FileUtils.readStrippedJsonFile(uri) as IOpenEdgeMainConfig
		data.modifiedTime = configModifiedTime
		configMap.set(uri.fsPath, data)
		return data
	} catch (caught) {
		log.error('[loadConfigFile] Failed to parse ' + uri.fsPath + ': ' + caught)
		throw new Error('Failed to parse ' + uri.fsPath + ': ' + caught)
	}
}

function readGlobalOpenEdgeRuntimes (workspaceUri: Uri) {
	log.debug('[readGlobalOpenEdgeRuntimes]')
	oeRuntimes = workspace.getConfiguration('abl.configuration').get<IOERuntime[]>('runtimes') ?? []
	const oeRuntimesDefault = workspace.getConfiguration('abl').get('configuration.defaultRuntime')

	if (!workspace.workspaceFolders) return

	if (oeRuntimesDefault != '') {
		// set default flag on the runtime that matches the defaultRuntime setting
		oeRuntimes.forEach(runtime => {
			// we have a default set, so ignore the default in the array
			if (runtime.name === oeRuntimesDefault) {
				runtime.default = true
			} else {
				runtime.default = false
			}
			runtime.path = runtime.path.replace(/\\/g, '/')
			runtime.pathExists = FileUtils.doesDirExist(Uri.file(runtime.path))
		})
		oeRuntimes = oeRuntimes.filter(runtime => runtime.pathExists)
	}

	if (oeRuntimes.length == 0) {
		log.warn('[readGlobaleOpenEdgeRuntimes] No OpenEdge runtime configured on this machine')
	}

	let defaultRuntime: IOERuntime | undefined = undefined
	oeRuntimes.forEach(runtime => {
		if (runtime.default) {
			defaultRuntime = runtime
			return
		}
	})
	if (!defaultRuntime && oeRuntimes.length === 1) {
		defaultRuntime = oeRuntimes[0]
	}

	let defaultProject: OpenEdgeProjectConfig | undefined
	if (defaultRuntime != null) {
		defaultProject = new OpenEdgeProjectConfig(workspaceUri)
		defaultProject.dlc = defaultRuntime.path
		defaultProject.oeversion = defaultRuntime.name
		defaultProject.extraParameters = ''
		defaultProject.graphicalMode = false
		defaultProject.propath = []
	}
}

function parseOpenEdgeConfig (rootUri: Uri, cfg: IOpenEdgeConfig | undefined): ProfileConfig {
	log.debug('[parseOpenEdgeConfig] cfg = ' + JSON.stringify(cfg, null, 2))
	const retVal = new ProfileConfig(rootUri)
	if (cfg?.oeversion) {
		retVal.dlc = getDlcDirectory(cfg.oeversion)
	} else if (process.env['DLC']) {
		retVal.dlc = process.env['DLC']
	}
	retVal.extraParameters = cfg?.extraParameters ?? ''
	retVal.charset = cfg?.charset ?? ''
	retVal.oeversion = cfg?.oeversion ?? ''
	retVal.graphicalMode = cfg?.graphicalMode ?? false
	if (cfg?.buildPath)
		retVal.propath = cfg.buildPath.map(str => str.path.replace('${DLC}', retVal.dlc)) ?? ''
	retVal.buildPath = cfg?.buildPath ?? []
	retVal.startupProc = ''
	retVal.parameterFiles = []
	retVal.dbDictionary = []
	retVal.dbConnections = cfg?.dbConnections ?? []
	retVal.procedures = cfg?.procedures ?? []

	return retVal
}

function parseOpenEdgeProjectConfig (uri: Uri, workspaceUri: Uri, config: IOpenEdgeMainConfig, ablunitProfile: boolean): OpenEdgeProjectConfig {
	log.debug('[parseOpenEdgeProjectConfig] uri = ' + uri.fsPath)
	const prjConfig = new OpenEdgeProjectConfig(workspaceUri)
	prjConfig.name = config.name
	prjConfig.version = config.version
	readGlobalOpenEdgeRuntimes(workspaceUri)
	prjConfig.dlc = getDlcDirectory(config.oeversion)
	prjConfig.extraParameters = config.extraParameters ?? ''
	prjConfig.charset = config.charset
	prjConfig.oeversion = config.oeversion
	prjConfig.graphicalMode = config.graphicalMode
	prjConfig.buildDirectory = config.buildDirectory ?? workspaceUri.fsPath
	if (config.buildPath && config.buildPath.length > 0) {
		prjConfig.propath = config.buildPath.map(str => str.path.replace('${DLC}', prjConfig.dlc))
	} else {
		// default the propath to the root of the workspace
		prjConfig.propath = [ '.' ]
	}
	if (config.buildPath) {
		prjConfig.buildPath = config.buildPath
		for (const b of prjConfig.buildPath) {
			if (!b.build) {
				b.build = config.buildDirectory
			}
			if (!b.build) {
				b.build = prjConfig.propath[0]
			}
		}
	} else {
		prjConfig.buildPath = [{
			type: 'source',
			build: config.buildDirectory ?? prjConfig.propath[0],
			xref: '.builder/pct',
			path: prjConfig.propath[0],
			pathUri: FileUtils.toUri(prjConfig.propath[0]),
		}]
	}

	for (const b of prjConfig.buildPath) {
		if (FileUtils.isRelativePath(b.path)) {
			b.pathUri = Uri.joinPath(prjConfig.rootUri, b.path)
		} else {
			b.pathUri = Uri.file(b.path)
		}
	}

	prjConfig.dbConnections = config.dbConnections ?? []
	prjConfig.procedures = config.procedures ?? []

	prjConfig.profiles.set('default', prjConfig)
	if (config.profiles) {
		config.profiles.forEach(profile => {
			const p = parseOpenEdgeConfig(prjConfig.rootUri, profile.value)
			if (profile.inherits && prjConfig.profiles.get(profile.inherits)) {
				const parent = prjConfig.profiles.get(profile.inherits)
				p.overwriteValues(parent)
			}
			for (const b of p.buildPath) {
				if (FileUtils.isRelativePath(b.path)) {
					b.pathUri = Uri.file(path.join(prjConfig.rootDir, b.path))
				} else {
					b.pathUri = Uri.file(b.path.replace('${DLC}', p.dlc))
				}
			}
			prjConfig.profiles.set(profile.name, p)
		})
	}

	// Active profile
	if (ablunitProfile && prjConfig.profiles.has('ablunit')) {
		prjConfig.activeProfile = 'ablunit'
	} else {
		const actProf = getActiveProfile(prjConfig.rootDir)
		if (actProf) {
			if (prjConfig.profiles.has(actProf)) {
				prjConfig.activeProfile = actProf
			} else {
				prjConfig.activeProfile = 'default'
			}
		} else {
			prjConfig.activeProfile = 'default'
		}
	}
	return prjConfig
}

function readOEConfigFile (uri: Uri, workspaceUri: Uri, openedgeProjectProfile?: string, ablunitProfile = true) {
	log.debug('uri = ' + uri.fsPath + ', workspaceUri=' + workspaceUri.fsPath)
	const projects: OpenEdgeProjectConfig[] = []

	const config = loadConfigFile(uri)
	if (!config) {
		const ret = new OpenEdgeProjectConfig(workspaceUri)
		ret.activeProfile = openedgeProjectProfile
		return ret
	}
	const prjConfig = parseOpenEdgeProjectConfig(uri, workspaceUri, config, ablunitProfile)
	if (prjConfig.dlc != '') {
		log.debug('OpenEdge project configured in ' + prjConfig.rootDir + ' -- DLC: ' + prjConfig.dlc)
		const idx: number = projects.findIndex((element) =>
			element.name == prjConfig.name && element.version == prjConfig.version
		)
		if (idx > -1) {
			if (projects[idx].rootDir == prjConfig.rootDir)
				projects[idx] = prjConfig
			else {
				log.info('Duplicate project ' + prjConfig.name + ' ' + prjConfig.version + ' found in ' + prjConfig.rootDir + ' and ' + projects[idx].rootDir)
			}
		} else {
			projects.push(prjConfig)
		}
	} else {
		log.info('[readOEConfigFile] Skip OpenEdge project in ' + prjConfig.rootDir + ' -- OpenEdge install not found')
	}
	return prjConfig
}

function getWorkspaceProfileConfig (workspaceUri: Uri, openedgeProjectProfile?: string, ablunitProfile = true) {
	let uri = workspaceUri
	if (!FileUtils.doesFileExist(workspaceUri)) {
		uri = Uri.joinPath(workspaceUri, 'openedge-project.json')
		if (!FileUtils.doesFileExist(uri)) {
			return undefined
		}
	}
	const workspaceFolderUri = workspace.getWorkspaceFolder(uri)?.uri
	if (!workspaceFolderUri) {
		throw new Error('Uri does not exist in workspace: ')
	}
	log.debug('[getWorkspaceProfileConfig] uri = ' + uri.fsPath)
	const prjConfig = readOEConfigFile(uri, workspaceFolderUri, openedgeProjectProfile, ablunitProfile)

	const activeProfile = openedgeProjectProfile ?? prjConfig.activeProfile

	if (activeProfile) {
		const prf =  prjConfig.profiles.get(activeProfile)
		if (prf) {
			if (prf.buildPath.length == 0) {
				prf.buildPath = prjConfig.buildPath
			}
			if (prf.propath.length == 0)
				prf.propath = prjConfig.propath
			for (const e of prf.buildPath) {
				e.build = e.build ?? e.path
			}
			return prf
		}
	}
	if (prjConfig && openedgeProjectProfile) {
		return prjConfig.profiles.get(openedgeProjectProfile) ?? prjConfig.profiles.get('default')
	}
	return undefined
}

export function getOpenEdgeProfileConfig (workspaceUri: Uri, openedgeProjectProfile?: string) {
	const profileConfig = getWorkspaceProfileConfig(workspaceUri, openedgeProjectProfile)
	if (profileConfig) {
		return profileConfig
	}
	return undefined
}

export function getProfileCharset (workspaceUri: Uri, openedgeProjectProfile?: string) {
	const profileConfig = getWorkspaceProfileConfig(workspaceUri, openedgeProjectProfile)
	if (!profileConfig) {
		log.debug('[getProfileCharset] profileConfig is undefined')
		return undefined
	}
	return profileConfig.charset
}

export function getExtraParameters (workspaceUri: Uri, openedgeProjectProfile?: string) {
	const profileConfig = getWorkspaceProfileConfig(workspaceUri, openedgeProjectProfile)
	if (!profileConfig) {
		log.debug('[getExtraParameters] profileConfig is undefined')
		return undefined
	}
	return profileConfig.extraParameters
}

export function getProfileDbConns (workspaceUri: Uri, openedgeProjectProfile?: string, ablunitProfile = true) {
	log.debug('[getProfileDbConns] workspaceUri = ' + workspaceUri.fsPath)

	const profileConfig = getWorkspaceProfileConfig(workspaceUri, openedgeProjectProfile, ablunitProfile)
	if (!profileConfig) {
		log.info('[getProfileDbConns] profileConfig is undefined')
		return []
	}
	log.trace('[getProfileDbConns] profileConfig.dbConnections = ' + JSON.stringify(profileConfig.dbConnections, null, 2))
	return profileConfig.dbConnections
}

export function getBuildPathPatterns (workspaceFolder: WorkspaceFolder, buildPath: IBuildPathEntry): { includes: RelativePattern[]; excludes: RelativePattern[] } {
	const includes: RelativePattern[] = []
	if (buildPath.includesFile) {
		const lines = FileUtils.readLinesFromFileSync(FileUtils.toUri(buildPath.includesFile))
		includes.push(...lines.map(p => new RelativePattern(workspaceFolder, workspace.asRelativePath(buildPath.path) + '/' + p)))
	} else {
		for (const p of buildPath.includes?.split(',') ?? []) {
			includes.push(new RelativePattern(workspaceFolder, workspace.asRelativePath(buildPath.pathUri) + '/' + p))
		}
	}

	const excludes: RelativePattern[] = []
	if (buildPath.excludesFile) {
		const lines = FileUtils.readLinesFromFileSync(FileUtils.toUri(buildPath.excludesFile))
		excludes.push(...lines.map(p => new RelativePattern(workspaceFolder, workspace.asRelativePath(buildPath.path) + '/' + p)))
	} else {
		for (const p of buildPath.excludes?.split(',') ?? []) {
			excludes.push(new RelativePattern(workspaceFolder, workspace.asRelativePath(buildPath.pathUri) + '/' + p))
		}
	}
	return { includes: includes, excludes: excludes }
}


// This file adapted from vscode-abl/vscode-abl
//
// https://github.com/vscode-abl/vscode-abl/blob/main/src/shared/OpenedgeProjectParser.ts
// https://github.com/vscode-abl/vscode-abl/blob/main/src/extension.ts
//
// MIT License
//
// Copyright (c) 2016 chriscamicas
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
