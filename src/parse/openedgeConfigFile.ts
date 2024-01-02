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

require('jsonminify')
import * as path from 'path'
import * as fs from 'fs'
import { Uri, workspace } from 'vscode'
import { log, logToChannel } from '../ABLUnitCommon'

interface IOERuntime {
	name: string
	path: string
	pathExists: boolean
	default: boolean
}

interface OpenEdgeConfig {
	// Content of a profile section in openedge-project.json
	oeversion: string
	numThreads: number
	graphicalMode: boolean
	extraParameters?: string
	buildPath?: BuildPathEntry[]
	buildDirectory?: string
	dbConnections: IDatabaseConnection[]
	procedures: Procedure[]
}

export interface IDatabaseConnection {
	name: string
	dumpFile: string
	connect: string
	aliases: string[]
}

interface OpenEdgeMainConfig extends OpenEdgeConfig {
	// JSON mapping of openedge-project.json
	name: string
	version: string
	profiles?: OEProfile[]
}

interface BuildPathEntry {
	type: string
	path: string
}

interface Procedure {
	name: string
	mode: string
}
interface OEProfile {
	name: string
	inherits: string
	value: OpenEdgeConfig
}

let oeRuntimes: IOERuntime[] = []

class ProfileConfig {
	name?: string
	version?: string
	oeversion: string = ''
	extraParameters?: string
	gui: boolean = false
	dlc: string = ''
	propath: string[] = []
	dbConnections: IDatabaseConnection[] = []
	procedures: Procedure[] = []

	propathMode: string = 'append'
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
	rootDir?: string
	profiles: Map<string, ProfileConfig> = new Map<string, ProfileConfig>()
}

function loadConfigFile (filename: string): OpenEdgeMainConfig {
	console.log("[loadConfigFile] filename = " + filename)
	if (!filename) {
		throw new Error("filename is undefined")
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return JSON.parse(JSON.minify(fs.readFileSync(filename, { encoding: 'utf8' })))
	} catch (caught) {
		throw new Error("Failed to parse " + filename + ": " + caught)
	}
}

function readGlobalOpenEdgeRuntimes () {
	console.log("[readGlobalOpenEdgeRuntimes]")
	oeRuntimes = workspace.getConfiguration('abl.configuration').get<Array<IOERuntime>>('runtimes') ?? []
	console.log("[readGlobalOpenEdgeRuntimes] oeRuntimes = " + JSON.stringify(oeRuntimes, null, 2))
	const oeRuntimesDefault = workspace.getConfiguration('abl').get('configuration.defaultRuntime')
	console.log("[readGlobalOpenEdgeRuntimes] oeRuntimesDefault = " + oeRuntimesDefault)

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
			logToChannel("[readGlobalOpenEdgeRuntimes] pathExists=" + runtime.pathExists + ", " + runtime.path, 'debug')
		})
		oeRuntimes = oeRuntimes.filter(runtime => runtime.pathExists)
	}

	log.debug("[readGlobalOpenEdgeRuntimes] oeRuntimes.length = " + oeRuntimes.length)
	log.debug("[readGlobalOpenEdgeRuntimes] oeRuntimes = " + JSON.stringify(oeRuntimes, null, 2))

	if (oeRuntimes.length == 0) {
		logToChannel('[readGlobaleOpenEdgeRuntimes] No OpenEdge runtime configured on this machine', 'warn')
	}

	let defaultRuntime = oeRuntimes.find(runtime => runtime.default)
	if (!defaultRuntime && oeRuntimes.length === 1) {
		defaultRuntime = oeRuntimes[0]
	}

	let defaultProject: OpenEdgeProjectConfig | undefined
	if (defaultRuntime != null) {
		defaultProject = new OpenEdgeProjectConfig()
		defaultProject.dlc = defaultRuntime.path
		defaultProject.rootDir = workspace.workspaceFolders[0].uri.fsPath // TODO
		defaultProject.oeversion = defaultRuntime.name
		defaultProject.extraParameters = ''
		defaultProject.gui = false
		defaultProject.propath = []
	}
}

function getDlcDirectory (version: string): string {
	log.debug("[getDlcDirectory] version = " + version)
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

	log.debug('[getDlcDirectory] dlc = ' + dlc + ", dfltDlc = " + dfltDlc)
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

function parseOpenEdgeConfig (cfg: OpenEdgeConfig): ProfileConfig {
	console.log("[parseOpenEdgeConfig] cfg = " + JSON.stringify(cfg, null, 2))
	const retVal = new ProfileConfig()
	retVal.dlc = getDlcDirectory(cfg.oeversion)
	retVal.extraParameters = cfg.extraParameters
	retVal.oeversion = cfg.oeversion
	retVal.gui = cfg.graphicalMode
	if (cfg.buildPath)
		retVal.propath = cfg.buildPath.map(str => str.path.replace('${DLC}', retVal.dlc))
	retVal.propathMode = 'append'
	retVal.startupProc = ''
	retVal.parameterFiles = []
	retVal.dbDictionary = []
	retVal.dbConnections = cfg.dbConnections
	retVal.procedures = cfg.procedures

	return retVal
}

function parseOpenEdgeProjectConfig (uri: Uri, config: OpenEdgeMainConfig): OpenEdgeProjectConfig {
	console.log("[parseOpenEdgeProjectConfig] uri = " + uri.fsPath)
	const prjConfig = new OpenEdgeProjectConfig()
	prjConfig.name = config.name
	prjConfig.version = config.version
	prjConfig.rootDir = Uri.parse(path.dirname(uri.path)).fsPath
	readGlobalOpenEdgeRuntimes()
	prjConfig.dlc = getDlcDirectory(config.oeversion)
	prjConfig.extraParameters = config.extraParameters ? config.extraParameters : ""
	prjConfig.oeversion = config.oeversion
	prjConfig.gui = config.graphicalMode
	prjConfig.propath = [ '.' ] // default the propath to the root of the workspace
	if (config.buildPath) {
		prjConfig.propath = config.buildPath.map(str => str.path.replace('${DLC}', prjConfig.dlc))
	}
	prjConfig.propathMode = 'append'
	prjConfig.dbConnections = config.dbConnections
	prjConfig.procedures = config.procedures

	prjConfig.profiles.set("default", prjConfig)
	if (config.profiles) {
		config.profiles.forEach(profile => {
			const p = parseOpenEdgeConfig(profile.value)
			if (profile.inherits && prjConfig.profiles.get(profile.inherits)) {
				p.overwriteValues(prjConfig.profiles.get(profile.inherits))
			}
			prjConfig.profiles.set(profile.name, p)
		})
	}

	// Active profile
	if (fs.existsSync(path.join(prjConfig.rootDir, ".vscode", "profile.json"))) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const txt = JSON.parse(fs.readFileSync(path.join(prjConfig.rootDir, ".vscode", "profile.json"), { encoding: 'utf8' }))
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const actProf = <string>txt['profile']
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

function readOEConfigFile (uri: Uri) {
	logToChannel("[readOEConfigFile] uri = " + uri.fsPath, 'debug')
	const projects: OpenEdgeProjectConfig[] = []

	logToChannel("[readOEConfigFile] OpenEdge project config file found: " + uri.fsPath)
	const config = loadConfigFile(uri.fsPath)

	const prjConfig = parseOpenEdgeProjectConfig(uri, config)
	logToChannel(("[readOEConfigFile] --- prjConfig = " + JSON.stringify(prjConfig, null, 2)))
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

function getWorkspaceProfileConfig(uri: Uri) {
	logToChannel("[getWorkspaceProfileConfig] uri = " + uri.fsPath, 'debug')
	const prjConfig = readOEConfigFile(uri)

	if (prjConfig?.activeProfile) {
		return prjConfig.profiles.get(prjConfig.activeProfile)
	}
	if (prjConfig) {
		return prjConfig.profiles.get("default")
	}
	return undefined
}

export function getProfileDbConns (workspaceUri: Uri) {
	logToChannel("[getProfileDbConns] workspaceUri = " + workspaceUri.fsPath, 'debug')

	const profileConfig = getWorkspaceProfileConfig(Uri.joinPath(workspaceUri, 'openedge-project.json'))
	logToChannel("[getProfileDbConns] profileConfig = " + JSON.stringify(profileConfig, null, 2), 'debug')
	log.debug("[getProfileDbConns] profileConfig = " + JSON.stringify(profileConfig, null, 2))
	if (!profileConfig) {
		logToChannel("[getProfileDbConns] profileConfig is undefined")
		return []
	}
	logToChannel("[getProfileDbConns] profileConfig.dbConnections = " + JSON.stringify(profileConfig.dbConnections, null, 2), 'debug')
	return profileConfig.dbConnections
}