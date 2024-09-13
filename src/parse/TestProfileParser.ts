import { FileSystemError, Uri, WorkspaceFolder, workspace } from 'vscode'
import { CoreOptions } from './config/CoreOptions'
import { IRunProfile, DefaultRunProfile } from './config/RunProfile'
import { ProfilerOptions } from './config/ProfilerOptions'
import { CommandOptions } from './config/CommandOptions'
import { isRelativePath, readStrippedJsonFile } from '../ABLUnitCommon'
import { log } from '../ChannelLogger'
import { IDatabaseConnection, getExtraParameters, getProfileCharset, getProfileDbConns } from './OpenedgeProjectParser'

const runProfileFilename = 'ablunit-test-profile.json'

export interface IConfigurations {
	// Import the json from .vscode/ablunit-test-profile.json and cast to this interface
	// If the cast fails the file is invalid, so throw an error.
	// Otherwise we're good to go!
	configurations: IRunProfile[]
}

function getConfigurations (uri: Uri) {
	const data = readStrippedJsonFile(uri)
	try {
		let str = JSON.stringify(data)
		if (str === '' || str === '{}') {
			str = '{ "configurations":[] }'
		}
		return JSON.parse(str) as IConfigurations
	} catch (err) {
		log.error('Failed to parse ablunit-test-profile: ' + err)
		throw err
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
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				into[key] = from[key]
			} else {
				// @ts-expect-error ThisIsSafeForTesting
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				into[key] = mergeObjects(from[key], into[key])
			} // @ts-expect-error ThisIsSafeForTesting
		} else if (from[key] != undefined) {
			// @ts-expect-error ThisIsSafeForTesting
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
	const defaultConfig = getDefaultConfig()

	const runProfiles: IRunProfile[] = []
	for (const workspaceFolder of workspaceFolders) {
		let wfConfig: IConfigurations
		try {
			wfConfig = getConfigurations(Uri.joinPath(workspaceFolder.uri, '.vscode', wsFilename))
		} catch (err) {
			if (err instanceof FileSystemError && err.code === 'ENOENT') {
				log.warn('no .vscode/' + wsFilename + ' file found.  using default profile')
				return defaultConfig.configurations
			}
			log.notificationWarning('Could not import .vscode/ablunit-test-profile.json.  Attempting to use default profile...')
			log.warn('err=' + err)
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
				if (!folderProfile) {
					folderProfile = wfConfig.configurations[0]
				}
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
			if (!profile.tempDir) {
				profile.tempDir = '${workspaceFolder}/.ablunit'
			}

			const wsFolder = profile.workspaceFolder?.uri.fsPath ?? '.'
			profile.tempDir = profile.tempDir.replace('${workspaceFolder}', wsFolder)
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

	if (isRelativePath(dir)) {
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
		locationUri: Uri,
		filenameUri: Uri
		jsonUri?: Uri
	}
	public readonly progressIniUri: Uri | undefined
	public readonly profOptsUri: Uri
	public readonly profListingsUri: Uri | undefined
	public readonly profFilenameUri: Uri
	public readonly dbConns: IDatabaseConnection[]
	public readonly dbConnPfUri: Uri
	public dbAliases: string[] = []

	constructor (private readonly profile: IRunProfile, public workspaceFolder: WorkspaceFolder) {
		super()
		this.tempDirUri = this.getUri(this.profile.tempDir)
		log.debug('tempDirUri=' + this.tempDirUri.fsPath)
		this.config_uri = Uri.joinPath(this.tempDirUri, 'ablunit.json')
		this.profOptsUri = Uri.joinPath(this.tempDirUri, 'profile.options')
		this.dbConnPfUri = Uri.joinPath(this.tempDirUri, 'dbconn.pf')
		this.importOpenedgeProjectJson = this.profile.importOpenedgeProjectJson
		this.openedgeProjectProfile = this.profile.openedgeProjectProfile ?? undefined
		this.dbConns = getProfileDbConns(this.workspaceFolder.uri, this.profile.openedgeProjectProfile)

		this.options = new CoreOptions(this.profile.options)
		const tmpFilename = (this.profile.options?.output?.filename?.replace(/\.xml$/, '') ?? 'results') + '.xml'
		this.optionsUri = {
			locationUri: this.getUri(this.profile.options?.output?.location + '/'),
			filenameUri: Uri.joinPath(this.tempDirUri, tmpFilename),
		}
		this.options.output.location = workspace.asRelativePath(this.optionsUri.locationUri, false)
		this.optionsUri.filenameUri = Uri.joinPath(this.optionsUri.locationUri, tmpFilename)

		log.debug('this.options.output.writeJson=' + this.options.output.writeJson)
		if (this.options.output.writeJson) {
			this.optionsUri.jsonUri = Uri.joinPath(this.optionsUri.locationUri, tmpFilename.replace(/\.xml$/, '') + '.json')
		}
		log.debug('this.optionsUri.jsonUri=' + this.optionsUri.jsonUri?.fsPath)

		this.command = new CommandOptions(this.profile.command)
		if (this.command.progressIni != '') {
			this.progressIniUri = this.getUri(this.command.progressIni)
			this.command.progressIni = workspace.asRelativePath(this.progressIniUri, false)
		} else {
			this.progressIniUri = undefined
		}

		const extraParameters = getExtraParameters(this.workspaceFolder.uri, this.profile.openedgeProjectProfile)
		log.info('extraParameters=' + extraParameters)
		if (extraParameters) {
			this.command.additionalArgs.push(extraParameters)
		}

		const charset = getProfileCharset(this.workspaceFolder.uri, this.profile.openedgeProjectProfile)
		// this.command.additionalArgs.push('-cpinternal', 'UTF-8')
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

export function getProfileConfig (workspaceFolder: WorkspaceFolder) {
	return new RunConfig(parseRunProfiles([workspaceFolder])[0], workspaceFolder)
}
