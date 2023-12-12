import { FileType, Uri, workspace, WorkspaceFolder } from 'vscode'
import { logToChannel } from './ABLUnitCommon'
import { IProjectJson, readOpenEdgeProjectJson } from './parse/OpenedgeProjectParser'
import { PropathParser } from './ABLPropath'
import { platform } from 'os'
import { getProfileConfig, RunConfig } from './parse/RunProfileParser'
import { IABLUnitJson, ITestObj } from './ABLResults'
import { CoreOptions } from './parse/config/CoreOptions'
import { ProfilerOptions } from './parse/config/ProfilerOptions'


// KEEP IN REPO CONFIG:
//  * notificationsEnabled
//  * discoverFilesOnActivate
//  * importOpenedgeProjectJson
//  *

export const ablunitConfig = new WeakMap<WorkspaceFolder, RunConfig>()

export class ABLUnitConfig  {

	// ablunitConfig: IABLUnitConfig = <IABLUnitConfig>{}
	ablunitConfig: RunConfig = <RunConfig>{}

	async setup(workspaceFolder: WorkspaceFolder) {
		this.ablunitConfig = await getProfileConfig(workspaceFolder)
		console.log("[ABLUnitConfigWriter constructor] workspaceUri=" + this.ablunitConfig.workspaceFolder.uri.fsPath)
		console.log("[ABLUnitConfigWriter constructor] tempDir=" + this.ablunitConfig.tempDirUri.fsPath)
	}

	async deleteFile(uri: Uri) {
		return workspace.fs.delete(uri).then(() => {
			console.log("deleted file: " + uri.fsPath)
		}, () => {
			//do nothing.  if the file doesn't exist we can just continue on.
		})
	}

	async writeFile(uri: Uri, data: Uint8Array) {
		return workspace.fs.writeFile(uri, data)
	}

	async createDir(uri: Uri) {
		return workspace.fs.stat(uri).then(() => {}, () => {
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

	async createAblunitJson(uri: Uri, cfg: CoreOptions, testQueue: ITestObj[]) {
		console.log("creating ablunit.json: '" + this.ablunitConfig.config_uri.fsPath + "'")
		const promarr: PromiseLike<void>[] = []
		promarr.push(
			workspace.fs.stat(this.ablunitConfig.options.locationUri).then((stat) => {
				if (stat.type != FileType.Directory) {
					throw new Error("configJson.output.location is not a Directory: " + this.ablunitConfig.options.locationUri.fsPath)
				}
			}, () => {
				return this.createDir(this.ablunitConfig.options.locationUri)
			})
		)
		promarr.push(this.deleteFile(this.ablunitConfig.options.filenameUri))
		if (this.ablunitConfig.options.jsonUri) {
			promarr.push(this.deleteFile(this.ablunitConfig.options.jsonUri))
		}

		const out = <IABLUnitJson>{
			options: cfg,
			tests: testQueue
		}

		promarr.push(workspace.fs.writeFile(this.ablunitConfig.config_uri, Uint8Array.from(Buffer.from(JSON.stringify(out, null, 4)))))
		return Promise.all(promarr)
	}

	async createProfileOptions (uri: Uri, profilerOptions: ProfilerOptions) {
		if (!profilerOptions.enabled) { return Promise.resolve() }

		const opt: string[] = [
			'-profiling',
			'-filename "' + profilerOptions.filename + '"',
			'-description "' + profilerOptions.description + '"'
		]

		if (profilerOptions.coverage) {
			opt.push('-coverage')
		}

		if (profilerOptions.listings != '') {
			opt.push('-listings "' + profilerOptions.listings + '"')
			await this.createDir(this.ablunitConfig.profListingsUri)
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
		await this.deleteFile(this.ablunitConfig.profFilenameUri)
		await this.writeFile(uri, Uint8Array.from(Buffer.from(opt.join('\n') + '\n')))
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
				return parser.setPropath(propath)
			}
			return parser.setPropath(dflt)
		}, (err) => {
			console.error("error reading openedge-project.json, falling back to default propath '.'\nerror: " + err)
			return parser.setPropath(dflt)
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
