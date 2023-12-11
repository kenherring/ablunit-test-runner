import { Uri, WorkspaceFolder, workspace } from 'vscode'

interface ITestPatterns {
	include: string | string[]
	exclude: string | string[]
}

interface ICommandConfig {
	executable: string
	progressIni: string
	batch: boolean
	additionalArgs: string[]
}

interface ICoreConfig {
	output?: {
		location?: string
		format?: "xml" | [ "xml" ] | [ "xml", "json"]
		writeJson?: boolean //= false
	}
	quitOnEnd?: boolean //= true
	writeLog?: boolean //= true
	showErrorMessage?: boolean //= true
	throwError?: boolean //= true
}

interface IProfileOptions {
	enabled?: boolean //= true
	coverage?: boolean //= true
	description?: string //= "Run via VSCode - ABLUnit Test Provider Extension"
	filename?: string //= "prof.out"
	listings?: string //= ""
	statistics?: boolean //= false
	traceFilter?: string //= ""
	tracing?: string //= ""
	writeJson?: boolean //= false
}

interface IRunProfile {
	runProfile?: string
	hide?: boolean
	enabled?: true
	workspaceFolder?: WorkspaceFolder
	tempDir?: string | null
	importOpenEdgeProjectJson: boolean
	files?: ITestPatterns
	command?: ICommandConfig
	config?: ICoreConfig
	profile?: IProfileOptions
}

export interface IConfigurations {
	// Import the json from .vscode/ablunit-test-profile.json and cast to this interface
	// If the cast fails the file is invalid, so throw an error.
	// Otherwise we're good to go!
	configurations: IRunProfile[]
}

async function readJson (uri: Uri) {
	const data = await workspace.fs.readFile(uri).then((raw) => {
		const d = Buffer.from(raw.buffer).toString().trim().replace(/[\r\t]/g,'').replace(/\/\/.*/g,'').replace(/^$/g,'')
		return d
	}, (err: Error) => {
		console.error("Failed to parse openedge-run-profile.json: " + err)
		throw err
	})
	return <JSON>JSON.parse(data)
}

async function getConfigurations(uri: Uri) {
	return readJson(uri).then((data) => {
		try {
			let str = JSON.stringify(data)
			if (str === '' || str === '{}') {
				str = '{ "configurations":[] }'
			}
			return <IConfigurations>JSON.parse(str)
		} catch (err) {
			console.error("Failed to parse openedge-run-profile.json: " + err)
			throw err
		}
		// throw new Error("Failed (without error caught) to parse openedge-run-profile.json")
	})
	// console.log("[readJson] data[0]=" + JSON.stringify(data))
	// if (data === '' || data === '{}') {
	// 	data = '{ "configurations":[] }'
	// }

	// try {
	// 	console.log("[readJson] JSON.parse-1")
	// 	return <JSON>JSON.parse(JSON.stringify(<JSON>JSON.parse(data)))
	// 	// const d = <JSON>JSON.parse(JSON.stringify(<JSON>JSON.parse(data)))
	// 	// return <IConfigurations>d
	// } catch (err) {
	// 	console.error("Failed to parse openedge-run-profile.json: " + err)
	// 	throw err
	// }
}

function mergeObjects (mergeFrom: object, defaults: object) {
	console.log("mergeObjects")
	console.log("typeof from = " + typeof mergeFrom)
	console.log("typeof defaults = " + typeof defaults)

	if(typeof mergeFrom !== typeof defaults) {
		throw new Error("Merge objects must be the same type! (from=" + typeof mergeFrom + ", defaults=" + typeof defaults + ")")
	}
	console.log('[mergeObjects]-1')
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const merged = defaults
	console.log("[mergeObjects]-2 merged=" + JSON.stringify(merged))

	for(const prop in merged) {
		console.log('[mergeObjects]-2 ' + prop + " " + typeof prop)
		// if (mergeFrom.hasOwnProperty(key)) {
		// 	if (typeof mergeFrom[key] === 'object') {
		// 		if (Array.isArray(mergeFrom[key])) {
		// 			// merge arrays
		// 			mergedConfig[key] = mergeFrom[key].concat(mergedConfig[key])
		// 		} else {
		// 			// merge objects
		// 			mergedConfig[key] = mergeConfig(mergedConfig[key], mergeFrom[key])
		// 		}
		// 	} else {
		// 		// merge properties
		// 		mergedConfig[key] = mergeFrom[key]
		// 	}
		// }
	}
	return merged
}

const runProfileFilename: string = 'ablunit-test-profile.json'
const saveDefaultConfig: IConfigurations | undefined = undefined


async function getDefaultConfig (extensionResources: Uri) {
	if(saveDefaultConfig) {
		return saveDefaultConfig
	}
	const defaultUri = Uri.joinPath(extensionResources, runProfileFilename.replace(/\.json$/,'.default.json'))
	const defaultConfig = await getConfigurations(defaultUri).catch((err) => {throw err})
	return defaultConfig
}


export async function parseRunProfiles(extensionResources: Uri, workspaceFolders: WorkspaceFolder[], wsFilename: string = runProfileFilename) {
	if (workspaceFolders.length === 0) {
		throw new Error("Workspace has no open folders")
	}
	const defaultConfig = await getDefaultConfig(extensionResources)

	const runProfiles: IRunProfile[] = []
	for (const workspaceFolder of workspaceFolders) {
		const wfConfig = await getConfigurations(Uri.joinPath(workspaceFolder.uri,'.vscode',wsFilename))

		for(const dfltProfile of defaultConfig.configurations) {

			const folderProfile = wfConfig.configurations.find((profile) => {
				console.log("profile.runProfile-find=" + profile.runProfile)
				return profile.runProfile === dfltProfile.runProfile
			})

			if(!folderProfile) {
				console.log("folderProfile = " + JSON.stringify(folderProfile))
				console.log("push default profile=" + dfltProfile.runProfile)
				runProfiles.push(dfltProfile)
				continue
			}

			const merged = <IRunProfile>mergeObjects(folderProfile, dfltProfile)
			if (merged.hide != false) {
				console.log("push merged profile=" + merged.runProfile)
				runProfiles.push(merged)
			}
		}
	}

	return runProfiles
}
