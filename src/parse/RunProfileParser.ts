import { Uri, WorkspaceFolder, workspace } from 'vscode'
import { isRelativePath } from '../ABLUnitConfigWriter'
import { CoreOptions } from './config/CoreOptions'
import {  IRunProfile, DefaultRunProfile } from './config/RunProfile'
import { ProfilerOptions } from './config/ProfilerOptions'
import { CommandOptions } from './config/CommandOptions'


const runProfileFilename: string = 'ablunit-test-profile.json'

export interface IConfigurations {
	// Import the json from .vscode/ablunit-test-profile.json and cast to this interface
	// If the cast fails the file is invalid, so throw an error.
	// Otherwise we're good to go!
	configurations: IRunProfile[]
}

async function readJson (uri: Uri) {
	const data = await workspace.fs.readFile(uri).then((raw) => {
		let d = Buffer.from(raw.buffer).toString().trim()

		// this json cleanup is a bit hacky, but it works
		d = d.replace(/[\r\t]/g,'').replace(/\/\/.*/g,'').replace(/^$/g,'') // remove tabs, carriage returns, and single line comments
		d = d.replace(/\/\*.*\*\//g,'') // remove multi-line comments
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
	})
}

function mergeObjects (from: object, into: object) {
	if(typeof from !== typeof into) {
		throw new Error("Merge objects must be the same type! (from=" + typeof from + ", into=" + typeof into + ")")
	}

	// Object.entries(from).forEach(([key, value]) => {
	// 	console.log("[mergeObjects]-2.2 key=" + key + ", value=" + value)
	// })
	// Object.entries(into).forEach(([key, value]) => {
	// 	console.log("[mergeObjects]-2.3 key=" + key + ", value=" + value)
	// })

	Object.entries(from).forEach(([key,]) => {
		// @ts-expect-error 123
		if (typeof from[key] === 'object') {
			// @ts-expect-error 123
			if (into[key] === undefined) {
				// @ts-expect-error 123
				console.error('into.' + key + ' is undefined and the value will not be merged (value = ' + JSON.stringify(from[key]) + ')')
			// @ts-expect-error 123
			} else if (Array.isArray(from[key])) {
				// @ts-expect-error 123
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				into[key] = from[key]
			} else {
				// @ts-expect-error 123
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				into[key] = mergeObjects(from[key], into[key])
			}
		} else {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			// @ts-expect-error 123
			if (from[key] != undefined) {
				// @ts-expect-error 123
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
				into[key] = from[key]
			}
		}
	})
	return into
}

function getDefaultConfig () {
	return <IConfigurations> { configurations: [ new DefaultRunProfile ] }
}

export async function parseRunProfiles(workspaceFolders: WorkspaceFolder[], wsFilename: string = runProfileFilename) {
	if (workspaceFolders.length === 0) {
		throw new Error("Workspace has no open folders")
	}
	const defaultConfig = getDefaultConfig()

	const runProfiles: IRunProfile[] = []
	for (const workspaceFolder of workspaceFolders) {
		const wfConfig = await getConfigurations(Uri.joinPath(workspaceFolder.uri,'.vscode',wsFilename))

		for(const dfltProfile of defaultConfig.configurations) {
			let folderProfile: IRunProfile | undefined = undefined
			if (wfConfig.configurations.length === 0) {
				folderProfile = undefined
			} else {
				folderProfile = wfConfig.configurations.find((profile) => profile.runProfile === dfltProfile.runProfile)
				if (!folderProfile) {
					folderProfile = wfConfig.configurations[0]
				}
			}

			if(!folderProfile) {
				runProfiles.push(dfltProfile)
				continue
			}

			const merged = <IRunProfile>mergeObjects(folderProfile, dfltProfile)
			if (!merged.hide) {
				runProfiles.push(merged)
			}
		}
	}

	console.log("runProfiles=" + JSON.stringify(runProfiles))
	return runProfiles
}

export async function parseRunProfile(workspaceFolder: WorkspaceFolder) {
	const runProfiles = await parseRunProfiles([workspaceFolder])
	if (runProfiles.length === 0) {
		throw new Error("No run profiles found")
	}
	return runProfiles[0]
}


function getUri (dir: string | undefined, workspaceFolder: WorkspaceFolder): Uri {
	if (dir === undefined || dir === '') {
		return workspaceFolder.uri
	}
	if (isRelativePath(dir)) {
		return Uri.joinPath(workspaceFolder.uri, dir)
	} else {
		return Uri.file(dir)
	}
}

export class RunConfig {
	public readonly tempDirUri: Uri
	public readonly config_uri: Uri
	public readonly options: {
		locationUri: Uri,
		filenameUri: Uri
		jsonUri?: Uri
	}
	public readonly coreOpts: CoreOptions
	public readonly command: CommandOptions
	public readonly progressIniUri: Uri
	public readonly profOptsUri: Uri
	public readonly profListingsUri: Uri
	public readonly profFilenameUri: Uri
	public readonly profOpts: ProfilerOptions = new ProfilerOptions()

	constructor(private readonly profile: IRunProfile,
				public workspaceFolder: WorkspaceFolder) {
		this.tempDirUri = this.getUri(this.profile.tempDir)
		this.config_uri = Uri.joinPath(this.tempDirUri, 'ablunit.json')
		this.profOptsUri = Uri.joinPath(this.tempDirUri, 'profile.options')

		const tmpFilename = (this.profile.options?.output?.filename?.replace(/\.xml$/,'') ?? 'results') + '.xml'
		this.options = {
			locationUri: this.getUri(this.profile.options?.output?.location),
			filenameUri: Uri.joinPath(this.tempDirUri, tmpFilename),
		}
		this.coreOpts = new CoreOptions(this.profile.options)

		this.command = new CommandOptions(this.profile.command)
		this.progressIniUri = this.getUri(this.command.progressIni)

		if (this.profile.options?.output?.writeJson) {
			this.options.jsonUri = Uri.joinPath(this.tempDirUri, tmpFilename.replace(/\.xml$/,'') + '.json')
		}
		this.profOpts.merge(this.profile.profilerOpts)
		this.profListingsUri = this.getUri(this.profOpts.listings)
		this.profFilenameUri = this.getUri(this.profOpts.filename)
	}

	getUri (dir: string | undefined): Uri {
		return getUri(dir, this.workspaceFolder)
	}
}

export function getProfileConfig(workspaceFolder: WorkspaceFolder) {
	return parseRunProfile(workspaceFolder).then((prof) => {
		return new RunConfig(prof, workspaceFolder)
	})
}
