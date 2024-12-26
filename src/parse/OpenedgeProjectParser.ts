import { Uri, workspace, WorkspaceFolder } from 'vscode'
import { log } from '../ChannelLogger'
import * as FileUtils from '../FileUtils'
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
	buildDirectory?: string
	dbConnections: IDatabaseConnection[]
	procedures: IProcedure[]
}

interface IOpenEdgeMainConfig extends IOpenEdgeConfig {
	// JSON mapping of openedge-project.json
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
	type: string
	path: string
	buildDir: string
	xrefDir: string
}

let oeRuntimes: IOERuntime[] = []
const dlcMap = new Map<WorkspaceFolder, IDlc>()

function getProjectJson (workspaceFolder: WorkspaceFolder) {
	const data = JSON.stringify(FileUtils.readStrippedJsonFile(Uri.joinPath(workspaceFolder.uri, 'openedge-project.json')))
	return data
}

export function getDLC (workspaceFolder: WorkspaceFolder, openedgeProjectProfile?: string, projectJson?: string) {
	const dlc = dlcMap.get(workspaceFolder)
	if (dlc) {
		return dlc
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
		return dlcObj
	}
	throw new Error('unable to determine DLC')
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
	log.info('oeversion not found, returning undefined')
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

	public overwriteValues (parent: ProfileConfig | undefined) {
		if (!parent) return

		if (!this.oeversion) {
			this.oeversion = parent.oeversion
			this.dlc = parent.dlc
		}
		if (!this.extraParameters) {
			this.extraParameters = parent.extraParameters
		}
		if (!this.charset) {
			this.charset = parent.charset
		}
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
	rootDir = '.'
	override buildDirectory = '.'
	profiles: Map<string, ProfileConfig> = new Map<string, ProfileConfig>()
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

function loadConfigFile (filename: string): IOpenEdgeMainConfig | undefined {
	log.debug('[loadConfigFile] filename = ' + filename)
	if (!filename) {
		throw new Error('filename is undefined')
	}

	if (!FileUtils.doesFileExist(Uri.file(filename))) {
		return undefined
	}
	try {
		const data = FileUtils.readStrippedJsonFile(filename)
		return data as unknown as IOpenEdgeMainConfig
	} catch (caught) {
		log.error('[loadConfigFile] Failed to parse ' + filename + ': ' + caught)
		throw new Error('Failed to parse ' + filename + ': ' + caught)
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
		defaultProject = new OpenEdgeProjectConfig()
		defaultProject.dlc = defaultRuntime.path
		defaultProject.rootDir = workspaceUri.fsPath
		defaultProject.oeversion = defaultRuntime.name
		defaultProject.extraParameters = ''
		defaultProject.graphicalMode = false
		defaultProject.propath = []
	}
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

function parseOpenEdgeConfig (cfg: IOpenEdgeConfig | undefined): ProfileConfig {
	log.debug('[parseOpenEdgeConfig] cfg = ' + JSON.stringify(cfg, null, 2))
	const retVal = new ProfileConfig()
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

function parseOpenEdgeProjectConfig (uri: Uri, workspaceUri: Uri, config: IOpenEdgeMainConfig): OpenEdgeProjectConfig {
	log.debug('[parseOpenEdgeProjectConfig] uri = ' + uri.fsPath)
	const prjConfig = new OpenEdgeProjectConfig()
	prjConfig.name = config.name
	prjConfig.version = config.version
	prjConfig.rootDir = Uri.file(path.dirname(uri.path)).fsPath
	readGlobalOpenEdgeRuntimes(workspaceUri)
	prjConfig.dlc = getDlcDirectory(config.oeversion)
	prjConfig.extraParameters = config.extraParameters ? config.extraParameters : ''
	prjConfig.charset = config.charset
	prjConfig.oeversion = config.oeversion
	prjConfig.graphicalMode = config.graphicalMode
	if (config.buildPath && config.buildPath.length > 0) {
		prjConfig.propath = config.buildPath.map(str => str.path.replace('${DLC}', prjConfig.dlc))
	} else {
		// default the propath to the root of the workspace
		prjConfig.propath = [ '.' ]
	}
	prjConfig.buildPath = config.buildPath ?? []
	prjConfig.buildDirectory = config.buildDirectory ?? workspaceUri.fsPath
	prjConfig.dbConnections = config.dbConnections ?? []
	prjConfig.procedures = config.procedures ?? []

	prjConfig.profiles.set('default', prjConfig)
	if (config.profiles) {
		config.profiles.forEach(profile => {
			const p = parseOpenEdgeConfig(profile.value)
			if (profile.inherits && prjConfig.profiles.get(profile.inherits)) {
				const parent = prjConfig.profiles.get(profile.inherits)
				p.overwriteValues(parent)
			}
			prjConfig.profiles.set(profile.name, p)
		})
	}

	// Active profile
	if (prjConfig.profiles.has('ablunit')) {
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

function readOEConfigFile (uri: Uri, workspaceUri: Uri, openedgeProjectProfile?: string) {
	log.debug('[readOEConfigFile] uri = ' + uri.fsPath)
	const projects: OpenEdgeProjectConfig[] = []

	log.info('[readOEConfigFile] OpenEdge project config file found: ' + uri.fsPath)
	const config = loadConfigFile(uri.fsPath)
	if (!config) {
		const ret = new OpenEdgeProjectConfig()
		ret.activeProfile = openedgeProjectProfile
		return ret
	}

	const prjConfig = parseOpenEdgeProjectConfig(uri, workspaceUri, config)
	if (prjConfig.dlc != '') {
		log.info('OpenEdge project configured in ' + prjConfig.rootDir + ' -- DLC: ' + prjConfig.dlc)
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

function getWorkspaceProfileConfig (workspaceUri: Uri, openedgeProjectProfile?: string) {
	const uri = Uri.joinPath(workspaceUri, 'openedge-project.json')
	log.debug('[getWorkspaceProfileConfig] uri = ' + uri.fsPath)
	const prjConfig = readOEConfigFile(uri, workspaceUri, openedgeProjectProfile)

	const activeProfile = openedgeProjectProfile ?? prjConfig.activeProfile

	if (activeProfile) {
		const prf =  prjConfig.profiles.get(activeProfile)
		if (prf) {
			if (prf.buildPath.length == 0)
				prf.buildPath = prjConfig.buildPath
			if (prf.propath.length == 0)
				prf.propath = prjConfig.propath
			for (const e of prf.buildPath) {
				if (!e.buildDir) {
					e.buildDir = e.path
				}
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

export function getProfileDbConns (workspaceUri: Uri, openedgeProjectProfile?: string) {
	log.debug('[getProfileDbConns] workspaceUri = ' + workspaceUri.fsPath)

	const profileConfig = getWorkspaceProfileConfig(workspaceUri, openedgeProjectProfile)
	if (!profileConfig) {
		log.info('[getProfileDbConns] profileConfig is undefined')
		return []
	}
	log.trace('[getProfileDbConns] profileConfig.dbConnections = ' + JSON.stringify(profileConfig.dbConnections, null, 2))
	return profileConfig.dbConnections
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
