import { Uri, workspace } from 'vscode'
import { outputChannel } from './ABLUnitCommon'
import { IProjectJson, readOpenEdgeProjectJson } from './parse/OpenedgeProjectParser';
import { PropathParser } from "./ABLPropath"
import * as os from 'os'

const workspaceDir = workspace.workspaceFolders![0].uri // TODO - handle multiple workspace folders

export interface IABLUnitJson {
	configPath: string
	configUri: Uri
	output: {
		location: string //results.xml directory
		locationUri: Uri //results.xml directory
		resultsFile: 'results.xml'
		resultsUri: Uri
		format: 'xml'
		writeJson: boolean
		jsonUri: Uri
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
	workspaceUri: Uri
	storageUri: Uri
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

export const ablunitConfig: IABLUnitConfig = {
	workspaceUri: workspaceDir,
	storageUri: workspaceDir,
	tempDir: workspace.getConfiguration('ablunit').get('tempDir', '').replace('${workspaceFolder}', workspaceDir.fsPath),
	tempDirUri: workspaceDir,
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
	params: '',
	progressIniPath: "progress.ini",
	progressIniUri: Uri.joinPath(workspaceDir, "progress.ini"),
	tests: {
		command: workspace.getConfiguration('ablunit').get('tests.command', ''),
		commandArr: [ '_progres', '-p', 'ABLUnitCore.p'],
		task: workspace.getConfiguration('ablunit').get('tests.task', ''),
	},
	configJson: {
		configPath: workspace.getConfiguration('ablunit').get('configJson.configPath', 'ablunit.json'),
		configUri: Uri.joinPath(workspaceDir, 'ablunit.json'),
		output: {
			location: workspace.getConfiguration('ablunit').get('configJson.outputLocation', ''),
			locationUri: workspaceDir,
			resultsFile: 'results.xml',
			resultsUri: Uri.joinPath(workspaceDir, 'results.xml'),
			format: 'xml',
			writeJson: workspace.getConfiguration('ablunit').get('configJson.writeJson', false),
			jsonUri: Uri.joinPath(workspaceDir,'results.json')
		},
		quitOnEnd: workspace.getConfiguration('ablunit').get('configJson.quitOnEnd', true),
		writeLog: workspace.getConfiguration('ablunit').get('configJson.writeLog', true),
		showErrorMessage: workspace.getConfiguration('ablunit').get('configJson.showErrorMessage', true),
		throwError: workspace.getConfiguration('ablunit').get('configJson.throwError', true),
	},
	profilerOptions: {
		enabled: workspace.getConfiguration('ablunit.profilerOptions').get('enabled', true),
		optionsPath: 'profile.options',
		optionsUri: Uri.joinPath(workspaceDir, 'profile.options'),
		coverage: workspace.getConfiguration('ablunit.profilerOptions').get('coverage', true),
		description: workspace.getConfiguration('ablunit.profilerOptions').get('description', 'Unit Tests Run via ABLUnit Test Provider (VSCode)'),
		filename: 'prof.out',
		filenameUri: Uri.joinPath(workspaceDir, 'prof.out'),
		listings: 'listings',
		listingsUri: Uri.joinPath(workspaceDir, 'listings'),
		statistics: workspace.getConfiguration('ablunit.profilerOptions').get('statistics', false),
		traceFilter: workspace.getConfiguration('ablunit.profilerOptions').get('traceFilter', ''),
		tracing: workspace.getConfiguration('ablunit.profilerOptions').get('tracing', ''),
		writeJson: workspace.getConfiguration('ablunit.profilerOptions').get('writeJson', false),
		jsonUri: Uri.joinPath(workspaceDir, 'prof.json')
	}
}

export class ABLUnitConfig  {

	constructor(workspaceDir: Uri) {
		ablunitConfig.workspaceUri = workspaceDir
		if (ablunitConfig.tempDir != '') {
			if (isRelativePath(ablunitConfig.tempDir)) {
				ablunitConfig.tempDirUri = Uri.joinPath(ablunitConfig.workspaceUri, ablunitConfig.tempDir)
			} else {
				ablunitConfig.tempDirUri = Uri.file(ablunitConfig.tempDir)
			}
			this.setTempDirUri(ablunitConfig.tempDirUri)
		}
		console.log("[ABLUnitConfig constructor] workspaceUri=" + workspaceDir.fsPath)
		console.log("[ABLUnitConfig constructor] tempDir=" + workspace.getConfiguration('ablunit').get('tempDir', ''))
	}

	async setTempDirUri (tempDir: Uri) {
		console.log("[setTempDirUri] tempDir=" + tempDir.fsPath)
		outputChannel.appendLine("using tempDir='" + ablunitConfig.tempDirUri.fsPath + "'")
		if (ablunitConfig.tempDirUri.fsPath == ablunitConfig.workspaceUri.fsPath) {
			console.log("skip setTempDir - tempDir is the same as workspace")
			return
		}

		if (isRelativePath(ablunitConfig.progressIniPath)) {
			ablunitConfig.progressIniUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.progressIniPath)
		}
		if (isRelativePath(ablunitConfig.configJson.configPath)) {
			ablunitConfig.configJson.configUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.configJson.configPath)
		}
		if (isRelativePath(ablunitConfig.configJson.output.location)) {
			ablunitConfig.configJson.output.locationUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.configJson.output.location)
		}
		if (isRelativePath(ablunitConfig.configJson.output.resultsFile)) {
			ablunitConfig.configJson.output.resultsUri = Uri.joinPath(ablunitConfig.configJson.output.locationUri, ablunitConfig.configJson.output.resultsFile)
			ablunitConfig.configJson.output.jsonUri = Uri.joinPath(ablunitConfig.configJson.output.locationUri, ablunitConfig.configJson.output.resultsFile.replace(/\.[a-zA-Z]+$/, '.json'))
		}
		if (isRelativePath(ablunitConfig.profilerOptions.optionsPath)) {
			ablunitConfig.profilerOptions.optionsUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.profilerOptions.optionsPath)
		}
		if (isRelativePath(ablunitConfig.profilerOptions.filename)) {
			ablunitConfig.profilerOptions.filenameUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.profilerOptions.filename)
		}
		if (isRelativePath(ablunitConfig.profilerOptions.listings)) {
			ablunitConfig.profilerOptions.listingsUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.profilerOptions.listings)
			ablunitConfig.profilerOptions.jsonUri = Uri.joinPath(ablunitConfig.tempDirUri, ablunitConfig.profilerOptions.filename.replace(/\.[a-zA-Z]+$/, '.json'))
		}
	}

	async createDir(uri: Uri) {
		return workspace.fs.stat(uri).then((stat) => {}, (err) => {
			console.log("creating directory: '" + workspace.asRelativePath(uri) + "'")
			return workspace.fs.createDirectory(uri)
		})
	}

	async createProgressIni(propath: string) {
		if (os.platform() != 'win32') { return }
		console.log("creating progress.ini: '" + ablunitConfig.progressIniUri.fsPath + "'")
		const iniData = ["[WinChar Startup]", "PROPATH=" + propath]
		const iniBytes = Uint8Array.from(Buffer.from(iniData.join("\n")))
		return workspace.fs.writeFile(ablunitConfig.progressIniUri, iniBytes)
	}

	async createAblunitJson(cfg: IABLUnitJson) {
		console.log("creating ablunit.json: '" + cfg.configUri.fsPath + "'")
		return workspace.fs.writeFile(cfg.configUri, Uint8Array.from(Buffer.from(JSON.stringify(cfg, null, 2))))
	}

	async createProfileOptions (profOpts: IProfilerOptions) {
		if (!profOpts.enabled) { return Promise.resolve()}

		const opt: string[] = [ '-profiling',
								'-filename "' + workspace.asRelativePath(profOpts.filenameUri) + '"',
								'-description "' + profOpts.description + '"' ]
		if (profOpts.coverage) {
			opt.push('-coverage')
		}
		if (profOpts.listings != "") {
			opt.push('-listings "' + workspace.asRelativePath(profOpts.listingsUri) + '"')
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
		console.log('creating profile.options: "' + workspace.asRelativePath(profOpts.optionsUri) + '"')
		return workspace.fs.writeFile(profOpts.optionsUri, Uint8Array.from(Buffer.from(opt.join('\n'))))
	}

	async readPropathFromJson() {
		console.log("reading propath from openedge-project.json")
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
			console.error("error reading openedge-project.json, falling back to default propath '.'\nerror: " + err)
			parser.setPropath(dflt)
			return parser
		})
		outputChannel.appendLine("propath='" + parser.toString() + "'")
		return parser
	}
}


function isRelativePath (path: string) {
	if(path.startsWith("/") || RegExp(/^[a-zA-Z]:\\/).exec(path)) {
		return false
	} else {
		return true
	}
}
