// This file adapted from vscode-abl/vscode-abl
//
// https://github.com/vscode-abl/vscode-abl/blob/main/src/shared/openEdgeConfigFile.ts
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

import * as path from 'path'
import * as fs from 'fs'
import { Uri, workspace } from 'vscode'
import { log, logToChannel, readStrippedJsonFile } from '../ABLUnitCommon'

interface IOERuntime {
	name: string
	path: string
	pathExists: boolean
	default: boolean
}

interface IOpenEdgeConfig {
	// Content of a profile section in openedge-project.json
	oeversion: string
	numThreads: number
	graphicalMode: boolean
	extraParameters?: string
	buildPath?: IBuildPathEntry[]
	buildDirectory?: string
	dbConnections: IDatabaseConnection[]
	procedures: IProcedure[]
}

export interface IDatabaseConnection {
	name: string
	dumpFile: string
	connect: string
	aliases: string[]
}

interface IOpenEdgeMainConfig extends IOpenEdgeConfig {
	// JSON mapping of openedge-project.json
	name: string
	version: string
	profiles?: IOEProfile[]
}

export interface IBuildPathEntry {
	type: string
	path: string
	buildDir: string
	xrefDir: string
}

interface IProcedure {
	name: string
	mode: string
}
interface IOEProfile {
	name: string
	inherits: string
	value: IOpenEdgeConfig
}

let oeRuntimes: IOERuntime[] = []

class ProfileConfig {
	name?: string
	version?: string
	oeversion?: string
	dlc: string = ''
	extraParameters?: string
	gui: boolean = false
	buildPath: IBuildPathEntry[] = []
	buildDirectory: string = '.'
	propath: string[] = []
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
		if (!this.extraParameters)
			this.extraParameters = parent.extraParameters
		if (!this.gui)
			this.gui = parent.gui
		if (!this.propath)
			this.propath = parent.propath
		if (this.buildPath.length == 0) {
			this.buildPath = parent.buildPath
		}
		if (!this.buildDirectory)
			this.buildDirectory = parent.buildDirectory
		if (!this.dbConnections)
			this.dbConnections = parent.dbConnections
		if (!this.procedures)
			this.procedures = parent.procedures
	}

	getTTYExecutable (): string {
		if (fs.existsSync(path.join(this.dlc, 'bin', '_progres.exe')))
			return path.join(this.dlc, 'bin', '_progres.exe')
		else
			return path.join(this.dlc, 'bin', '_progres')
	}

	getExecutable (gui?: boolean): string {
		if (gui || this.gui) {
			if (fs.existsSync(path.join(this.dlc, 'bin', 'prowin.exe')))
				return path.join(this.dlc, 'bin', 'prowin.exe')
			else
				return path.join(this.dlc, 'bin', 'prowin32.exe')
		} else if (fs.existsSync(path.join(this.dlc, 'bin', '_progres.exe')))
			return path.join(this.dlc, 'bin', '_progres.exe')
		else
			return path.join(this.dlc, 'bin', '_progres')
	}

}

class OpenEdgeProjectConfig extends ProfileConfig {
	activeProfile?: string
	rootDir: string = '.'
	buildDirectory: string = '.'
	profiles: Map<string, ProfileConfig> = new Map<string, ProfileConfig>()
}

export function getActiveProfile (rootDir: string) {
	if (fs.existsSync(path.join(rootDir, ".vscode", "profile.json"))) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const txt = JSON.parse(fs.readFileSync(path.join(rootDir, ".vscode", "profile.json"), { encoding: 'utf8' }).replace(/\r/g,''))
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const actProf = <string>txt['profile']
		return actProf
	}
	return "default"
}

function loadConfigFile (filename: string): IOpenEdgeMainConfig | undefined {
	log.debug("[loadConfigFile] filename = " + filename)
	if (!filename) {
		throw new Error("filename is undefined")
	}
	if (!fs.existsSync(filename)) {
		return undefined
	}
	try {
		const data = readStrippedJsonFile(filename)
		return <IOpenEdgeMainConfig><unknown>data
	} catch (caught) {
		log.error("[loadConfigFile] Failed to parse " + filename + ": " + caught)
		throw new Error("Failed to parse " + filename + ": " + caught)
	}
}

function readGlobalOpenEdgeRuntimes (workspaceUri: Uri) {
	logToChannel("[readGlobalOpenEdgeRuntimes]",'debug')
	oeRuntimes = workspace.getConfiguration('abl.configuration').get<Array<IOERuntime>>('runtimes') ?? []
	const oeRuntimesDefault = workspace.getConfiguration('abl').get('configuration.defaultRuntime')

	if (!workspace.workspaceFolders) return

	if (oeRuntimesDefault != "") {
		// set default flag on the runtime that matches the defaultRuntime setting
		oeRuntimes.forEach(runtime => {
			// we have a default set, so ignore the default in the array
			if (runtime.name === oeRuntimesDefault) {
				runtime.default = true
			} else {
				runtime.default = false
			}
			runtime.path = runtime.path.replace(/\\/g,'/')
			runtime.pathExists = fs.existsSync(runtime.path)
		})
		oeRuntimes = oeRuntimes.filter(runtime => runtime.pathExists)
	}

	if (oeRuntimes.length == 0) {
		log.warn('[readGlobaleOpenEdgeRuntimes] No OpenEdge runtime configured on this machine')
	}

	let defaultRuntime = oeRuntimes.find(runtime => runtime.default)
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
		defaultProject.gui = false
		defaultProject.propath = []
	}
}

function getDlcDirectory (version: string): string {
	let dlc: string = ""
	let dfltDlc: string = ""
	let dfltName: string = ""
	oeRuntimes.forEach(runtime => {
		if (runtime.name === version) {
			dlc = runtime.path
		}
		if (runtime.default === true) {
			dfltDlc = runtime.path
			dfltName = runtime.name
		}
		runtime.pathExists = fs.existsSync(runtime.path)
	})

	if (dlc === '' && oeRuntimes.length === 1) {
		dlc = oeRuntimes[0].path
	}

	if (dlc === '') {
		dlc = process.env.DLC ?? ''
	}

	if (dlc === '' && dfltDlc != '') {
		dlc = dfltDlc
		logToChannel("OpenEdge version not configured in workspace settings, using default version (" + dfltName + ") in user settings.")
	}
	return dlc
}

function parseOpenEdgeConfig (cfg: IOpenEdgeConfig): ProfileConfig {
	logToChannel("[parseOpenEdgeConfig] cfg = " + JSON.stringify(cfg, null, 2),'debug')
	const retVal = new ProfileConfig()
	retVal.dlc = getDlcDirectory(cfg.oeversion)
	retVal.extraParameters = cfg.extraParameters ?? ''
	retVal.oeversion = cfg.oeversion ?? ''
	retVal.gui = cfg.graphicalMode ?? ''
	if (cfg.buildPath)
		retVal.propath = cfg.buildPath.map(str => str.path.replace('${DLC}', retVal.dlc)) ?? ''
	retVal.buildPath = cfg.buildPath ?? []
	retVal.startupProc = ''
	retVal.parameterFiles = []
	retVal.dbDictionary = []
	retVal.dbConnections = cfg.dbConnections
	retVal.procedures = cfg.procedures

	return retVal
}

function parseOpenEdgeProjectConfig (uri: Uri, workspaceUri: Uri, config: IOpenEdgeMainConfig): OpenEdgeProjectConfig {
	logToChannel("[parseOpenEdgeProjectConfig] uri = " + uri.fsPath,'debug')
	const prjConfig = new OpenEdgeProjectConfig()
	prjConfig.name = config.name
	prjConfig.version = config.version
	prjConfig.rootDir = Uri.parse(path.dirname(uri.path)).fsPath
	readGlobalOpenEdgeRuntimes(workspaceUri)
	prjConfig.dlc = getDlcDirectory(config.oeversion)
	prjConfig.extraParameters = config.extraParameters ? config.extraParameters : ""
	prjConfig.oeversion = config.oeversion
	prjConfig.gui = config.graphicalMode
	if (config.buildPath && config.buildPath.length > 0) {
		prjConfig.propath = config.buildPath.map(str => str.path.replace('${DLC}', prjConfig.dlc))
	} else {
		// default the propath to the root of the workspace
		prjConfig.propath = [ '.' ]
	}
	prjConfig.buildPath = config.buildPath ?? []
	prjConfig.buildDirectory = config.buildDirectory ?? workspaceUri.fsPath
	prjConfig.dbConnections = config.dbConnections
	prjConfig.procedures = config.procedures

	prjConfig.profiles.set("default", prjConfig)
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
	const actProf = getActiveProfile(prjConfig.rootDir)
	if (actProf) {
		if (prjConfig.profiles.has(actProf)) {
			prjConfig.activeProfile = actProf
		} else {
			prjConfig.activeProfile = "default"
		}
	} else {
		prjConfig.activeProfile = "default"
	}
	return prjConfig
}

function readOEConfigFile (uri: Uri, workspaceUri: Uri) {
	logToChannel("[readOEConfigFile] uri = " + uri.fsPath, 'debug')
	const projects: OpenEdgeProjectConfig[] = []

	logToChannel("[readOEConfigFile] OpenEdge project config file found: " + uri.fsPath)
	const config = loadConfigFile(uri.fsPath)
	if (!config) {
		return new OpenEdgeProjectConfig()
	}

	const prjConfig = parseOpenEdgeProjectConfig(uri, workspaceUri, config)
	if (prjConfig.dlc != "") {
		logToChannel("OpenEdge project configured in " + prjConfig.rootDir + " -- DLC: " + prjConfig.dlc)
		const idx: number = projects.findIndex((element) =>
			(element.name == prjConfig.name) && (element.version == prjConfig.version)
		)
		if (idx > -1) {
			if (projects[idx].rootDir == prjConfig.rootDir)
				projects[idx] = prjConfig
			else {
				logToChannel("Duplicate project " + prjConfig.name + " " + prjConfig.version + " found in " + prjConfig.rootDir + " and " + projects[idx].rootDir)
			}
		} else {
			projects.push(prjConfig)
		}
		return prjConfig
	} else {
		logToChannel("[readOEConfigFile] Skip OpenEdge project in " + prjConfig.rootDir + " -- OpenEdge install not found")
	}
}

function getWorkspaceProfileConfig (workspaceUri: Uri) {
	const uri = Uri.joinPath(workspaceUri, 'openedge-project.json')
	logToChannel("[getWorkspaceProfileConfig] uri = " + uri.fsPath, 'debug')
	const prjConfig = readOEConfigFile(uri, workspaceUri)

	if (prjConfig?.activeProfile) {
		const prf =  prjConfig.profiles.get(prjConfig.activeProfile)
		if (prf) {
			if (!prf.buildPath)
				prf.buildPath = prjConfig.buildPath
			if (!prf.propath)
				prf.propath = prjConfig.propath
			for (const e of prf.buildPath) {
				e.buildDir = prjConfig.buildDirectory ?? workspaceUri
			}
			return prf
		}
	}
	if (prjConfig) {
		return prjConfig.profiles.get("default")
	}
	return undefined
}

export function getOpenEdgeProfileConfig (workspaceUri: Uri) {
	const profileConfig = getWorkspaceProfileConfig(workspaceUri)
	if (profileConfig) {
		return profileConfig
	}
	return undefined
}

export function getProfileDbConns (workspaceUri: Uri) {
	logToChannel("[getProfileDbConns] workspaceUri = " + workspaceUri.fsPath, 'debug')

	const profileConfig = getWorkspaceProfileConfig(workspaceUri)
	if (!profileConfig) {
		logToChannel("[getProfileDbConns] profileConfig is undefined")
		return []
	}
	logToChannel("[getProfileDbConns] profileConfig.dbConnections = " + JSON.stringify(profileConfig.dbConnections, null, 2), 'debug')
	return profileConfig.dbConnections
}
