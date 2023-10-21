import { Uri, workspace } from 'vscode'
import { outputChannel } from './ABLUnitCommon'
import { IProjectJson, readOpenEdgeProjectJson } from './projectSchema';
import { PropathParser } from "./ABLPropath"

interface IABLUnitJson {
	configPath: string
	configUri: Uri
	output: {
		location: string //results.xml directory
		locationUri: Uri //results.xml directory
		resultsFile: "results.xml"
		resultsUri: Uri
		format: "xml"
	}
	quitOnEnd: boolean
	writeLog: boolean
	showErrorMessage: boolean
	throwError: boolean
	tests?: [
		{
			test: string,
			cases?: [
				string
			]
		} |
		{
			folder: string
		}
	]
}

interface IProfilerOptions {
	optionsPath: string
	optionsUri: Uri
	enabled: boolean
	coverage: boolean
	description: string
	filename: string
	fileUri: Uri
	listings: string
	listingsUri: Uri
	statistics: boolean
	traceFilter: string
	tracing: string
}

export interface IABLUnitConfig {
	workspaceUri: Uri
	tempDirUri: Uri
	display: {
		classLabel: string
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
	configJson: IABLUnitJson
	profilerOptions: IProfilerOptions
}

// default values to start
export const ablunitConfig: IABLUnitConfig = {
	workspaceUri: workspace.workspaceFolders![0].uri, // TODO - handle multiple workspace folders
	// tempDir: "",
	tempDir: workspace.workspaceFolders![0].uri.fsPath,
	tempDirUri: workspace.workspaceFolders![0].uri, // TODO - handle multiple workspace folders
	display: {
		classLabel: workspace.getConfiguration('ablunit').get('classLabel', 'classpath'),
		style: workspace.getConfiguration('ablunit').get('files.style', 'tree'),
	},
	files: {
		include: workspace.getConfiguration('ablunit').get('files.include', '**/*.{cls,p}'),
		exclude: workspace.getConfiguration('ablunit').get('files.exclude', '**/.builder/**'),
	},
	findAllFilesAtStartup: workspace.getConfiguration('ablunit').get('findAllFilesAtStartup', true),
	importOpenedgeProjectJson:  workspace.getConfiguration('ablunit').get('importOpenedgeProjectJson', true),
	notificationsEnabled:  workspace.getConfiguration('ablunit').get('notificationsEnabled', true),
	params: "",
	progressIniPath: "progress.ini",
	progressIniUri: Uri.file(""),
	tests: {
		command: workspace.getConfiguration('ablunit').get('tests.command', ''),
		commandArr: [ '_progres', '-p', 'ABLUnitCore.p'],
		task: workspace.getConfiguration('ablunit').get('tests.task', ''),
	},
	configJson: {
		configPath: "ablunit.json",
		configUri: Uri.file(""),
		output: {
			location: workspace.getConfiguration('ablunit').get('configJson.output.location', ''),
			locationUri: Uri.file(""),
			resultsFile: "results.xml",
			resultsUri: Uri.file(""),
			format: "xml"
		},
		quitOnEnd: workspace.getConfiguration('ablunit').get('configJson.quitOnEnd', true),
		writeLog: workspace.getConfiguration('ablunit').get('configJson.writeLog', true),
		showErrorMessage: workspace.getConfiguration('ablunit').get('configJson.showErrorMessage', true),
		throwError: workspace.getConfiguration('ablunit').get('configJson.throwError', true),
	},
	profilerOptions: {
		optionsPath: workspace.getConfiguration('ablunit').get('profilerOptions.optionsPath', 'profile.options'),
		optionsUri: Uri.joinPath(workspace.workspaceFolders![0].uri,  workspace.getConfiguration('ablunit').get('profilerOptions.optionsPath', '')),
		enabled: workspace.getConfiguration('ablunit').get('profilerOptions.enabled', true),
		coverage: workspace.getConfiguration('ablunit').get('profilerOptions.coverage', true),
		description: workspace.getConfiguration('ablunit').get('profilerOptions.description', 'Unit Tests Run via ABLUnit Test Provider (VSCode)'),
		filename: workspace.getConfiguration('ablunit').get('profilerOptions.filename', 'prof.out'),
		fileUri: Uri.file(""),
		listings: workspace.getConfiguration('ablunit').get('profilerOptions.listings', 'listings'),
		listingsUri: Uri.file(""),
		statistics: workspace.getConfiguration('ablunit').get('profilerOptions.statistics', false),
		traceFilter: workspace.getConfiguration('ablunit').get('profilerOptions.traceFilter', ''),
		tracing: workspace.getConfiguration('ablunit').get('profilerOptions.tracing', ''),
	}
}

export class ABLUnitConfig  {

	constructor(workspaceDir: Uri) {
		ablunitConfig.workspaceUri = workspaceDir
		ablunitConfig.profilerOptions.fileUri = Uri.joinPath(ablunitConfig.tempDirUri, 'ablunit.json')
	}

	async setTempDirUri (storageUri: Uri) {
		ablunitConfig.tempDir = workspace.getConfiguration('ablunit').get('tempDir', '')
		if (!ablunitConfig.tempDir || ablunitConfig.tempDir === '') {
			ablunitConfig.tempDirUri = storageUri
			ablunitConfig.tempDir = storageUri.fsPath
		}

		if (RegExp(/^[a-zA-Z]:/).exec(ablunitConfig.tempDir)) {
			// if the configured path is absolute use it as-is
			ablunitConfig.tempDirUri = Uri.file(ablunitConfig.tempDir)
			//TODO test unix paths
		} else {
			ablunitConfig.tempDirUri = Uri.joinPath(ablunitConfig.workspaceUri, ablunitConfig.tempDir)
		}

		await this.createDir(ablunitConfig.tempDirUri)

		//TODO - account for absolute paths
		ablunitConfig.progressIniUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.progressIniPath)
		ablunitConfig.configJson.configUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.configJson.configPath)
		ablunitConfig.configJson.output.locationUri = ablunitConfig.tempDirUri
		ablunitConfig.configJson.output.resultsUri = Uri.joinPath(ablunitConfig.configJson.output.locationUri, ablunitConfig.configJson.output.resultsFile)

		console.log("ablConfig: " + JSON.stringify(ablunitConfig, null, 2))

		console.log("optionsPath=" +  ablunitConfig.profilerOptions.optionsPath)
		ablunitConfig.profilerOptions.optionsUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.profilerOptions.optionsPath)
		ablunitConfig.profilerOptions.fileUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.profilerOptions.filename)
		ablunitConfig.profilerOptions.listingsUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.profilerOptions.listings)
	}

	async createDir(uri: Uri) {
		return workspace.fs.stat(uri).then((stat) => {}, (err) => {
			return workspace.fs.createDirectory(uri)
		})
	}

	async createProgressIni(propath: string) {
		const iniData = ["[WinChar Startup]", "PROPATH=" + propath]
		const iniBytes = Uint8Array.from(Buffer.from(iniData.join("\n")))

		console.log("creating progress.ini: '" + ablunitConfig.progressIniUri.fsPath + "'")
		return workspace.fs.writeFile(ablunitConfig.progressIniUri, iniBytes)
	}

	async createAblunitJson(cfg: IABLUnitJson) {
		console.log("createAblunitJson")
		return workspace.fs.writeFile(cfg.configUri, Uint8Array.from(Buffer.from(JSON.stringify(cfg, null, 2)))).then(() => {
			console.log("created ablunit.json")
		}, (err) => {
			console.error("error creating ablunit.json: " + err)
			throw err
		})
	}

	async createProfileOptions (profOpts: IProfilerOptions) {
		if (!profOpts.enabled) {
			return
		}

		const opt: string[] = [ '-profiling',
								'-filename "' + profOpts.fileUri.fsPath + '"',
								'-description "' + profOpts.description + '"' ]
		if (profOpts.coverage) {
			opt.push('-coverage')
		}
		if (profOpts.listings != "") {
			opt.push('-listings "' + profOpts.listingsUri.fsPath + '"')
			await this.createDir(profOpts.listingsUri)
		}
		if (profOpts.statistics) {
			opt.push('-statistics')
		}
		if (profOpts.tracing != "") {
			opt.push('-tracing "' + profOpts.tracing + '"')
		}
		if (profOpts.traceFilter != '') {
			opt.push('-traceFilter "' + profOpts.traceFilter + '"')
		}
		console.log('creating profile.options: "' + profOpts.optionsUri.fsPath + '"')
		return workspace.fs.writeFile(profOpts.optionsUri, Uint8Array.from(Buffer.from(opt.join('\n'))))
	}

	async readPropathFromJson() {
		const parser: PropathParser = new PropathParser(ablunitConfig.workspaceUri)

		const dflt: IProjectJson = { propathEntry: [{
			path: '.',
			type: 'source',
			buildDir: '.',
			xrefDir: '.'
		}]}

		await readOpenEdgeProjectJson().then((propath) => {
			if (propath) {
				parser.setPropath(propath)
			} else {
				parser.setPropath(dflt)
			}
			return parser
		}, (err) => {
			console.log("error reading openedge-project.json: " + err)
			parser.setPropath(dflt)
			return parser
		})

		outputChannel.appendLine("propath='" + parser.toString() + "'")
		return parser
	}
}
