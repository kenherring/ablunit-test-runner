import { FileType, Uri, workspace, WorkspaceFolder } from 'vscode'
import { logToChannel } from './ABLUnitCommon'
import { IProjectJson, readOpenEdgeProjectJson } from './parse/OpenedgeProjectParser'
import { PropathParser } from './ABLPropath'
import { platform } from 'os'

export interface ITestObj {
	test: string
	cases?: string[]
}

export interface IFolderObj {
	folder: string
}

type TestsObj = ITestObj
// type TestsObj = ITestObj | IFolderObj

export interface IABLUnitJson {
	options: {
		output: {
			location: string //results.xml directory
			filename: string //<filename>.xml
			format: 'xml'
		}
		quitOnEnd: boolean
		writeLog: boolean
		showErrorMessage: boolean
		throwError: boolean
	}
	tests: TestsObj[]
}

export interface IProfilerOptions {
	optionsPath: string
	optionsUri: Uri
	enabled: boolean
	coverage: boolean
	description: string
	filename: string
	filenameUri: Uri
	listings: string
	listingsUri: Uri
	statistics: boolean
	traceFilter: string
	tracing: string
	writeJson: boolean
	jsonUri: Uri
}

export interface IABLUnitConfig {
	workspaceFolder: WorkspaceFolder
	storageUri: Uri
	tempDirUri: Uri
	display: {
		classlabel: string
		style: string
	}
	files: {
		include: string
		exclude: string
	}
	findAllFilesAtStartup: boolean
	importOpenedgeProjectJson: boolean
	notificationsEnabled: boolean
	params: string,
	progressIniPath: string
	progressIniUri: Uri
	tempDir: string
	tests: {
		command: string
		commandArr: string[]
		task: string
	}
	config_path: string
	config_uri: Uri,
	config_output_location: string,
	config_output_locationUri: Uri,
	config_output_filenameUri: Uri,
	config_output_jsonUri: Uri,
	config_output_writeJson: boolean,
	configJson: IABLUnitJson
	profilerOptions: IProfilerOptions
}

export const ablunitConfig = new WeakMap<WorkspaceFolder, IABLUnitConfig>()

function createAblunitConfig(workspaceFolder: WorkspaceFolder) {
	const cfg: IABLUnitConfig =  {
		workspaceFolder: workspaceFolder,
		storageUri: workspaceFolder.uri,
		tempDir: workspace.getConfiguration('ablunit').get('tempDir', '').replace('${workspaceFolder}', workspaceFolder.uri.fsPath),
		tempDirUri: workspaceFolder.uri,
		display: {
			classlabel: workspace.getConfiguration('ablunit').get('classlabel', 'filename'),
			style: workspace.getConfiguration('ablunit').get('files.style', 'tree'),
		},
		files: {
			include: workspace.getConfiguration('ablunit').get('files.include', '**/*.{cls,p}'),
			exclude: workspace.getConfiguration('ablunit').get('files.exclude', '**/.builder/**'),
		},
		findAllFilesAtStartup: workspace.getConfiguration('ablunit').get('findAllFilesAtStartup', true),
		importOpenedgeProjectJson:  workspace.getConfiguration('ablunit').get('importOpenedgeProjectJson', true),
		notificationsEnabled:  workspace.getConfiguration('ablunit').get('notificationsEnabled', true),
		params: workspace.getConfiguration('ablunit').get('params', ''),
		progressIniPath: "progress.ini",
		progressIniUri: Uri.joinPath(workspaceFolder.uri, "progress.ini"),
		tests: {
			command: workspace.getConfiguration('ablunit').get('tests.command', ''),
			commandArr: [ '_progres', '-p', 'ABLUnitCore.p'],
			task: workspace.getConfiguration('ablunit').get('tests.task', ''),
		},
		config_output_location: workspace.getConfiguration('ablunit').get('configJson.output.location', ''),
		config_output_locationUri: workspaceFolder.uri,
		config_output_filenameUri: Uri.joinPath(workspaceFolder.uri, 'results.xml'),
		config_output_jsonUri: Uri.joinPath(workspaceFolder.uri, 'results.json'),
		config_output_writeJson: workspace.getConfiguration('ablunit').get('configJson.output.writeJson', false),
		config_path: workspace.getConfiguration('ablunit').get('configJson.configPath', 'ablunit.json'),
		config_uri: Uri.joinPath(workspaceFolder.uri, 'ablunit.json'),
		configJson: {
			options: {
				output: {
					location: workspace.getConfiguration('ablunit').get('configJson.output.location',''),
					filename: workspace.getConfiguration('ablunit').get('configJson.output.filename', 'results').replace(/\.xml$/, '') + '.xml',
					format: 'xml',
				},
				quitOnEnd: workspace.getConfiguration('ablunit').get('configJson.quitOnEnd', true),
				writeLog: workspace.getConfiguration('ablunit').get('configJson.writeLog', true),
				showErrorMessage: workspace.getConfiguration('ablunit').get('configJson.showErrorMessage', true),
				throwError: workspace.getConfiguration('ablunit').get('configJson.throwError', true),
			},
			tests: []
		},
		profilerOptions: {
			enabled: workspace.getConfiguration('ablunit.profilerOptions').get('enabled', true),
			optionsPath: 'profile.options',
			optionsUri: Uri.joinPath(workspaceFolder.uri, 'profile.options'),
			coverage: workspace.getConfiguration('ablunit.profilerOptions').get('coverage', true),
			description: workspace.getConfiguration('ablunit.profilerOptions').get('description', 'Unit Tests Run via ABLUnit Test Provider (VSCode)'),
			filename: workspace.getConfiguration('ablunit.profilerOptions').get('filename', '').replace('${workspaceFolder}', workspaceFolder.uri.fsPath),
			filenameUri: Uri.joinPath(workspaceFolder.uri, 'prof.out'),
			listings: workspace.getConfiguration('ablunit.profilerOptions').get('listings', ''),
			listingsUri: Uri.joinPath(workspaceFolder.uri, 'listings'),
			statistics: workspace.getConfiguration('ablunit.profilerOptions').get('statistics', false),
			traceFilter: workspace.getConfiguration('ablunit.profilerOptions').get('traceFilter', ''),
			tracing: workspace.getConfiguration('ablunit.profilerOptions').get('tracing', ''),
			writeJson: workspace.getConfiguration('ablunit.profilerOptions').get('writeJson', false),
			jsonUri: Uri.joinPath(workspaceFolder.uri, 'prof.json')
		}
	}
	return cfg
}

export class ABLUnitConfig  {

	ablunitConfig: IABLUnitConfig

	constructor(workspaceFolder: WorkspaceFolder) {

		this.ablunitConfig = createAblunitConfig(workspaceFolder)
		let tempDir: Uri = this.ablunitConfig.workspaceFolder.uri
		if (this.ablunitConfig.tempDir != '') {
			if (isRelativePath(this.ablunitConfig.tempDir)) {
				tempDir = Uri.joinPath(this.ablunitConfig.workspaceFolder.uri, this.ablunitConfig.tempDir)
			} else {
				tempDir = Uri.file(this.ablunitConfig.tempDir)
			}
		}

		if (this.ablunitConfig.profilerOptions.listings == 'true') {
			this.ablunitConfig.profilerOptions.listings = 'listings'
		}

		this.setTempDirUri(tempDir, true)
		console.log("[ABLUnitConfigWriter constructor] workspaceUri=" + this.ablunitConfig.workspaceFolder.uri.fsPath)
		console.log("[ABLUnitConfigWriter constructor] tempDir=" + this.ablunitConfig.tempDirUri.fsPath)
	}

	resetAblunitConfig(workspaceFolder: WorkspaceFolder) {
		this.ablunitConfig = createAblunitConfig(workspaceFolder)
	}

	setTempDirUri (tempDir: Uri, fromConstructor: boolean = false) {
		if (!fromConstructor && this.ablunitConfig.tempDirUri === tempDir) {
			console.log("skip setTempDir - tempDir is the same as before (" + this.ablunitConfig.tempDirUri.fsPath + ")")
			return
		}
		this.ablunitConfig.tempDirUri = tempDir
		logToChannel("using tempDir=" + tempDir.fsPath)

		if (isRelativePath(this.ablunitConfig.progressIniPath)) {
			this.ablunitConfig.progressIniUri = Uri.joinPath(this.ablunitConfig.tempDirUri, this.ablunitConfig.progressIniPath)
		}
		if (isRelativePath(this.ablunitConfig.config_path)) {
			this.ablunitConfig.config_uri = Uri.joinPath(this.ablunitConfig.tempDirUri, this.ablunitConfig.config_path)
		}

		if (this.ablunitConfig.config_output_location == '') {
			this.ablunitConfig.config_output_locationUri = this.ablunitConfig.tempDirUri
		} else if (isRelativePath(this.ablunitConfig.config_output_location)) {
			this.ablunitConfig.config_output_locationUri = Uri.joinPath(this.ablunitConfig.workspaceFolder.uri, this.ablunitConfig.config_output_location)
		}
		this.ablunitConfig.configJson.options.output.location = this.ablunitConfig.config_output_locationUri.fsPath
		Uri.joinPath(this.ablunitConfig.config_output_locationUri, this.ablunitConfig.configJson.options.output.filename)
		Uri.joinPath(this.ablunitConfig.config_output_locationUri, this.ablunitConfig.configJson.options.output.filename.replace(/\.xml$/, '.json'))

		if (this.ablunitConfig.configJson.options.output.filename != '') {
			this.ablunitConfig.config_output_filenameUri = Uri.joinPath(this.ablunitConfig.config_output_locationUri, this.ablunitConfig.configJson.options.output.filename)
			this.ablunitConfig.config_output_jsonUri = Uri.joinPath(this.ablunitConfig.config_output_locationUri, this.ablunitConfig.configJson.options.output.filename.replace(/\.xml$/, '.json'))
		}

		if (isRelativePath(this.ablunitConfig.profilerOptions.optionsPath)) {
			this.ablunitConfig.profilerOptions.optionsUri = Uri.joinPath(this.ablunitConfig.tempDirUri, this.ablunitConfig.profilerOptions.optionsPath)
		}
		if (this.ablunitConfig.profilerOptions.filename != '') {
			if (isRelativePath(this.ablunitConfig.profilerOptions.filename)) {
				this.ablunitConfig.profilerOptions.filenameUri = Uri.joinPath(this.ablunitConfig.tempDirUri, this.ablunitConfig.profilerOptions.filename)
				this.ablunitConfig.profilerOptions.jsonUri = Uri.joinPath(this.ablunitConfig.tempDirUri, this.ablunitConfig.profilerOptions.filename.replace(/\.[a-zA-Z]+$/, '.json'))
			} else {
				this.ablunitConfig.profilerOptions.filenameUri = Uri.file(this.ablunitConfig.profilerOptions.filename)
				this.ablunitConfig.profilerOptions.jsonUri = Uri.file(this.ablunitConfig.profilerOptions.filename.replace(/\.[a-zA-Z]+$/, '.json'))
			}
		}
		if (this.ablunitConfig.profilerOptions.listings != '') {
			this.ablunitConfig.profilerOptions.listingsUri = Uri.file(this.ablunitConfig.profilerOptions.listings)
			if (isRelativePath(this.ablunitConfig.profilerOptions.listings)) {
				this.ablunitConfig.profilerOptions.listingsUri = Uri.joinPath(this.ablunitConfig.tempDirUri, this.ablunitConfig.profilerOptions.listings)
			}
		}
	}

	async deleteFile(uri: Uri) {
		return workspace.fs.delete(uri).then((val) => {
			console.log("deleted file: " + uri.fsPath)
		}, (err) => {
			// console.log("----- file '" + workspace.asRelativePath(uri, false) + "' does not exist")
			//do nothing.  if the file doesn't exist we can just continue on.
		})
	}

	async writeFile(uri: Uri, data: Uint8Array) {
		return workspace.fs.writeFile(uri, data)
	}

	async createDir(uri: Uri) {
		return workspace.fs.stat(uri).then((stat) => {}, (err) => {
			return workspace.fs.createDirectory(uri)
		})
	}

	async createProgressIni(propath: string) {
		if (platform() != 'win32') { return }
		console.log("creating progress.ini: '" + this.ablunitConfig.progressIniUri.fsPath + "'")
		const iniData = ["[WinChar Startup]", "PROPATH=" + propath]
		const iniBytes = Uint8Array.from(Buffer.from(iniData.join("\n")))
		return workspace.fs.writeFile(this.ablunitConfig.progressIniUri, iniBytes)
	}

	async createAblunitJson(cfg: IABLUnitJson) {
		console.log("creating ablunit.json: '" + this.ablunitConfig.config_uri.fsPath + "'")
		const promarr: PromiseLike<void>[] = []
		promarr.push(
			workspace.fs.stat(this.ablunitConfig.config_output_locationUri).then((stat) => {
				if (stat.type != FileType.Directory) {
					throw new Error("configJson.output.location is not a Directory: " + this.ablunitConfig.config_output_locationUri.fsPath)
				}
			}, (err) => {
				return this.createDir(this.ablunitConfig.config_output_locationUri)
			})
		)
		promarr.push(this.deleteFile(this.ablunitConfig.config_output_filenameUri))
		promarr.push(this.deleteFile(this.ablunitConfig.config_output_jsonUri))
		promarr.push(workspace.fs.writeFile(this.ablunitConfig.config_uri, Uint8Array.from(Buffer.from(JSON.stringify(cfg, null, 4)))))
		return Promise.all(promarr)
	}

	async createProfileOptions (profilerOptions: IProfilerOptions) {
		if (!profilerOptions.enabled) { return Promise.resolve() }

		const opt: string[] = [ '-profiling',
								'-filename "' + workspace.asRelativePath(profilerOptions.filenameUri, false) + '"',
								'-description "' + profilerOptions.description + '"' ]
		if (profilerOptions.coverage) {
			opt.push('-coverage')
		}

		if (profilerOptions.listings != '') {
			opt.push('-listings "' + workspace.asRelativePath(profilerOptions.listingsUri, false) + '"')
			await this.createDir(profilerOptions.listingsUri)
		}
		if (profilerOptions.statistics) {
			opt.push('-statistics')
		}
		if (profilerOptions.tracing != '') {
			opt.push('-tracing "' + profilerOptions.tracing + '"')
		}
		if (profilerOptions.traceFilter != '') {
			opt.push('-traceFilter "' + profilerOptions.traceFilter + '"')
		}
		await this.deleteFile(this.ablunitConfig.profilerOptions.filenameUri)
		await this.writeFile(profilerOptions.optionsUri, Uint8Array.from(Buffer.from(opt.join('\n') + '\n')))
	}

	async readPropathFromJson() {
		logToChannel("reading propath from openedge-project.json")
		const parser: PropathParser = new PropathParser(this.ablunitConfig.workspaceFolder)
		const dflt: IProjectJson = { propathEntry: [{
			path: '.',
			type: 'source',
			buildDir: '.',
			xrefDir: '.'
		}]}

		await readOpenEdgeProjectJson(this.ablunitConfig.workspaceFolder).then((propath) => {
			if (propath) {
				parser.setPropath(propath)
			} else {
				parser.setPropath(dflt)
			}
			return parser
		}, (err) => {
			console.error("error reading openedge-project.json, falling back to default propath '.'\nerror: " + err)
			parser.setPropath(dflt)
			return parser
		})
		logToChannel("using propath='" + parser.toString() + "'")
		return parser
	}
}

export function isRelativePath (path: string) {
	if(path.startsWith('/') || RegExp(/^[a-zA-Z]:[\\/]/).exec(path)) {
		return false
	} else {
		return true
	}
}
