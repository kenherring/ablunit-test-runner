import { FileSystemError, Uri, WorkspaceFolder, workspace } from 'vscode'
import { CoreOptions } from 'parse/config/CoreOptions'
import { IRunProfile, DefaultRunProfile } from 'parse/config/RunProfile'
import { ProfilerOptions } from 'parse/config/ProfilerOptions'
import { CommandOptions } from 'parse/config/CommandOptions'
import { log } from 'ChannelLogger'
import { IDatabaseConnection, getExtraParameters, getProfileCharset, getProfileDbConns } from 'parse/OpenedgeProjectParser'
import * as FileUtils from 'FileUtils'

const runProfileFilename = 'ablunit-test-profile.json'

export interface IConfigurations {
	// Import the json from .vscode/ablunit-test-profile.json and cast to this interface
	// If the cast fails the file is invalid, so throw an error.
	// Otherwise we're good to go!
	configurations: IRunProfile[]
}

function getConfigurations (uri: Uri) {
	const data = FileUtils.readStrippedJsonFile(uri)
	try {
		let str = JSON.stringify(data)
		if (str === '' || str === '{}') {
			str = '{ "configurations":[] }'
		}
		return JSON.parse(str) as IConfigurations
	} catch (e: unknown) {
		log.error('Failed to parse ablunit-test-profile: ' + e)
		throw e
	}
}

function mergeObjects (from: object, into: object) {
	if(typeof from !== typeof into) {
		throw new Error('Merge objects must be the same type! (from=' + typeof from + ', into=' + typeof into + ')')
	}

	Object.entries(from).forEach(([key,]) => {
		// @ts-expect-error ThisIsSafeForTesting
		if (typeof from[key] === 'object') {
			// @ts-expect-error ThisIsSafeForTesting
			if (into[key] === undefined) {
				// @ts-expect-error ThisIsSafe
				if (from[key]) {
					// @ts-expect-error ThisIsSafe
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					into[key] = from[key]
				}
			// @ts-expect-error ThisIsSafeForTesting
			} else if (Array.isArray(from[key])) {
				// @ts-expect-error ThisIsSafeForTesting
				into[key] = from[key]
			} else {
				// @ts-expect-error ThisIsSafeForTesting
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				into[key] = mergeObjects(from[key], into[key])
			} // @ts-expect-error ThisIsSafeForTesting
		} else if (from[key] != undefined) {
			// @ts-expect-error ThisIsSafeForTesting
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			into[key] = from[key]
		}
	})
	return into
}

function getDefaultConfig () {
	return { configurations: [ new DefaultRunProfile ] } as IConfigurations
}

export function parseRunProfiles (workspaceFolders: WorkspaceFolder[], wsFilename: string = runProfileFilename) {
	if (workspaceFolders.length === 0) {
		throw new Error('Workspace has no open folders')
	}
	const defaultConfig = (JSON.parse(JSON.stringify(getDefaultConfig())) as unknown) as IConfigurations

	const runProfiles: IRunProfile[] = []
	for (const workspaceFolder of workspaceFolders) {
		let wfConfig: IConfigurations
		try {
			wfConfig = getConfigurations(Uri.joinPath(workspaceFolder.uri, '.vscode', wsFilename))
		} catch (e: unknown) {
			if (e instanceof FileSystemError) {
				if (e.name === 'FileNotFound') {
					log.debug('no .vscode/' + wsFilename + ' file found.  using default profile (e=' + e.name + ')')
				}else {
					log.notificationWarning('Failed to import .vscode/ablunit-test-profile.json.  Attempting to use default profile...\n[' + e.code + ']: ' + e.message)
				}
			} else if (e instanceof Error) {
				// @ts-expect-error ThisIsSafeForTesting
				if (e.code == 'ENOENT') {
					log.debug('no .vscode/' + wsFilename + ' file found.  using default profile (e=' + e + ')')
				} else {
					log.notificationWarning('Failed to import .vscode/ablunit-test-profile.json!  Attempting to use default profile...\n(e=' + e + ')')
				}
			} else {
				log.notificationError('Failed to import .vscode/ablunit-test-profile.json!  Attempting to use default profile...\n(e=' + e + ')')
			}
			return defaultConfig.configurations
		}
		if (wfConfig.configurations.length === 0) {
			return defaultConfig.configurations
		}

		for(const dfltProfile of defaultConfig.configurations) {
			let folderProfile: IRunProfile | undefined = undefined
			if (wfConfig.configurations.length === 0) {
				folderProfile = undefined
			} else {
				folderProfile = wfConfig.configurations.find((profile) => profile.runProfile === dfltProfile.runProfile)
								?? wfConfig.configurations[0]
			}

			if(!folderProfile) {
				runProfiles.push(dfltProfile)
				continue
			}

			const merged = mergeObjects(folderProfile, dfltProfile) as IRunProfile
			if (!merged.hide) {
				runProfiles.push(merged)
			}
		}

		runProfiles.forEach((profile) => {
			profile.tempDir = profile.tempDir ?? '${workspaceFolder}/.ablunit'

			let wsFolder = '.'
			if (profile.workspaceFolder?.uri) {
				wsFolder = workspace.asRelativePath(profile.workspaceFolder?.uri, false)
			}
			profile.tempDir = profile.tempDir.replace('${workspaceFolder}', wsFolder)
			if (profile.options?.output?.location) {
				profile.options.output.location = profile.options.output.location.replace('${workspaceFolder}', wsFolder)
				profile.options.output.location = profile.options.output.location.replace('${tempDir}', profile.tempDir)
			}
		})
	}

	return runProfiles
}


function getUri (dir: string | undefined, workspaceFolderUri: Uri, tempDir?: Uri): Uri {
	if (dir === undefined || dir === '') {
		return workspaceFolderUri
	}

	if (tempDir != undefined) {
		dir = dir.replace('${tempDir}', tempDir.fsPath)
	}
	dir = dir.replace('${workspaceFolder}', workspaceFolderUri.fsPath)

	if (FileUtils.isRelativePath(dir)) {
		if (dir.includes('/') || dir.includes('\\')) {
			return Uri.joinPath(workspaceFolderUri, dir)
		} else {
			return Uri.joinPath(tempDir ?? workspaceFolderUri, dir)
		}
	} else {
		return Uri.file(dir)
	}
}

export class RunConfig extends DefaultRunProfile {
	public readonly tempDirUri: Uri
	public readonly config_uri: Uri
	public readonly optionsUri: {
		locationUri: Uri
		filenameUri: Uri
		jsonUri?: Uri
		updateUri: Uri | undefined
	}
	public readonly profOptsUri: Uri
	public readonly profListingsUri: Uri | undefined
	public readonly profFilenameUri: Uri
	public readonly dbConns: IDatabaseConnection[]
	public readonly dbConnPfUri: Uri
	public dbAliases: string[] = []

	constructor (private readonly profile: IRunProfile, public workspaceFolder: WorkspaceFolder, ablunitProfile = true) {
		super()
		this.tempDirUri = this.getUri(this.profile.tempDir)
		this.timeout = this.profile.timeout
		log.debug('tempDirUri="' + this.tempDirUri.fsPath + '"')
		this.config_uri = Uri.joinPath(this.tempDirUri, 'ablunit.json')
		this.profOptsUri = Uri.joinPath(this.tempDirUri, 'profile.options')
		this.dbConnPfUri = Uri.joinPath(this.tempDirUri, 'dbconn.pf')
		this.importOpenedgeProjectJson = this.profile.importOpenedgeProjectJson
		this.openedgeProjectProfile = this.profile.openedgeProjectProfile ?? undefined
		this.dbConns = getProfileDbConns(this.workspaceFolder.uri, this.profile.openedgeProjectProfile, ablunitProfile)

		this.options = new CoreOptions(this.profile.options)
		const tmpFilename = (this.profile.options?.output?.filename?.replace(/\.xml$/, '') ?? 'results') + '.xml'
		if (this.options?.output?.location) {
			this.options.output.location = this.options.output.location.replace(/\\\\/g, '/')
			if (!this.options.output.location.endsWith('/')) {
				// adding a trailing slash to indicate this is a drirectory to this.getUri
				this.options.output.location += '/'
			}
		}
		this.optionsUri = {
			locationUri: this.getUri(this.options?.output?.location),
			filenameUri: Uri.joinPath(this.tempDirUri, tmpFilename),
			updateUri: Uri.joinPath(this.tempDirUri, 'updates.log'),
		}
		this.options.output.location = this.optionsUri.locationUri.fsPath
		this.optionsUri.filenameUri = Uri.joinPath(this.optionsUri.locationUri, tmpFilename)

		log.debug('this.options.output.writeJson=' + this.options.output.writeJson)
		if (this.options.output.writeJson) {
			this.optionsUri.jsonUri = Uri.joinPath(this.optionsUri.locationUri, tmpFilename.replace(/\.xml$/, '') + '.json')
		}
		log.debug('this.optionsUri.jsonUri="' + this.optionsUri.jsonUri?.fsPath + '"')
		if (this.options.output.updateFile) {
			this.optionsUri.updateUri = Uri.joinPath(this.optionsUri.locationUri, this.options.output.updateFile)
		} else {
			this.optionsUri.updateUri = undefined
		}

		this.command = new CommandOptions(this.profile.command)

		const extraParameters = getExtraParameters(this.workspaceFolder.uri, this.profile.openedgeProjectProfile)?.split(' ')
		// TODO - re-join quoted strings
		if (extraParameters) {
			this.command.additionalArgs.push(...extraParameters)
		}

		const charset = getProfileCharset(this.workspaceFolder.uri, this.profile.openedgeProjectProfile)
		if (charset) {
			if (this.command.additionalArgs.includes('-cpstream')) {
				log.warn('command.additionalArgs already contains -cpstream.  Replacing with `-cpstream ' + charset)
				this.command.additionalArgs.splice(this.command.additionalArgs.indexOf('-cpstream'), 2, '-cpstream', charset)
			} else {
				this.command.additionalArgs.push('-cpstream', charset)
			}
		}

		this.profiler = new ProfilerOptions()
		this.profiler.merge(this.profile.profiler)
		this.profFilenameUri = this.getUri(this.profiler.filename)
		if (this.profFilenameUri) {
			this.profiler.filename = workspace.asRelativePath(this.profFilenameUri, false)
		}

		if (typeof this.profiler.listings === 'boolean') {
			if (this.profiler.listings) {
				this.profListingsUri = Uri.joinPath(this.tempDirUri, 'listings')
			}
		} else if (this.profiler.listings) {
			this.profListingsUri = this.getUri(this.profiler.listings)
		} else {
			this.profListingsUri = undefined
		}
		if (this.profListingsUri) {
			this.profiler.listings = workspace.asRelativePath(this.profListingsUri, false)
		}

		if (this.options.xref) {
			this.options.xref.xrefLocation = this.getUri(this.options.xref.xrefLocation).fsPath
		}
	}

	getUri (dir: string | undefined): Uri {
		return getUri(dir, this.workspaceFolder.uri, this.tempDirUri)
	}
}

export function getProfileConfig (workspaceFolder: WorkspaceFolder, ablunitProfile = true) {
	return new RunConfig(parseRunProfiles([workspaceFolder])[0], workspaceFolder, ablunitProfile)
}
