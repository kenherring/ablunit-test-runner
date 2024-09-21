import { FileType, TestRunRequest, Uri, workspace, WorkspaceFolder } from 'vscode'
import { log } from './ChannelLogger'
import { PropathParser } from './ABLPropath'
import { platform } from 'os'
import { getProfileConfig, RunConfig } from './parse/TestProfileParser'
import { IABLUnitJson, ITestObj } from './ABLResults'
import { CoreOptions } from './parse/config/CoreOptions'
import { ProfilerOptions } from './parse/config/ProfilerOptions'
import { getOpenEdgeProfileConfig, IBuildPathEntry, IDatabaseConnection, IDlc, ProfileConfig } from './parse/OpenedgeProjectParser'

export const ablunitConfig = new WeakMap<WorkspaceFolder, RunConfig>()

export class ABLUnitConfig  {

	// ablunitConfig: IABLUnitConfig = <IABLUnitConfig>{}
	ablunitConfig: RunConfig = {} as RunConfig

	setup (workspaceFolder: WorkspaceFolder, request: TestRunRequest) {
		log.info('[ABLUnitConfigWriter setup] workspaceUri=' + workspaceFolder.uri.fsPath)
		this.ablunitConfig = getProfileConfig(workspaceFolder)
		log.info('[ABLUnitConfigWriter constructor] setup complete! tempDir=' + this.ablunitConfig.tempDirUri.fsPath)
	}

	deleteFile (uri: Uri) {
		return workspace.fs.delete(uri).then(() => {
			log.info('deleted file: ' + uri.fsPath)
			return
		}, () => {
			// do nothing.  if the file doesn't exist we can just continue on.
		})
	}

	async writeFile (uri: Uri, data: Uint8Array) {
		await this.createDir(uri.with({ path: uri.path.split('/').slice(0, -1).join('/') }))
		return workspace.fs.writeFile(uri, data)
	}

	createDir (uri: Uri) {
		return workspace.fs.stat(uri).then(() => { return }, () => {
			return workspace.fs.createDirectory(uri)
		})
	}

	createProgressIni (propath: string, dlc: IDlc) {
		if (platform() != 'win32') { return }
		if (!this.ablunitConfig.progressIniUri) { return }
		log.info('creating progress.ini: \'' + this.ablunitConfig.progressIniUri.fsPath + '\'')
		const iniData = ['[WinChar Startup]', 'PROPATH=' + propath.replace(/\$\{DLC\}/g, dlc.uri.fsPath.replace(/\\/g, '/'))]
		const iniBytes = Uint8Array.from(Buffer.from(iniData.join('\n')))
		return workspace.fs.writeFile(this.ablunitConfig.progressIniUri, iniBytes)
	}

	createAblunitJson (_uri: Uri, cfg: CoreOptions, testQueue: ITestObj[]) {
		if (!this.ablunitConfig.config_uri) {
			throw new Error('Output location no defined!')
		}
		log.info('creating ablunit.json: \'' + this.ablunitConfig.config_uri.fsPath + '\'')
		const promarr: PromiseLike<void>[] = []
		promarr.push(
			workspace.fs.stat(this.ablunitConfig.optionsUri.locationUri).then((stat) => {
				if (stat.type != FileType.Directory) {
					throw new Error('configJson.output.location is not a Directory: ' + this.ablunitConfig.optionsUri.locationUri.fsPath)
				}
				return
			}, () => {
				return this.createDir(this.ablunitConfig.optionsUri.locationUri)
			})
		)
		promarr.push(this.deleteFile(this.ablunitConfig.optionsUri.filenameUri))
		if (this.ablunitConfig.optionsUri.jsonUri) {
			promarr.push(this.deleteFile(this.ablunitConfig.optionsUri.jsonUri))
		}

		const out = {
			options: cfg,
			tests: testQueue
		} as IABLUnitJson

		promarr.push(workspace.fs.writeFile(this.ablunitConfig.config_uri, Uint8Array.from(Buffer.from(JSON.stringify(out, null, 4)))))
		return Promise.all(promarr)
	}

	async createProfileOptions (uri: Uri, profOpts: ProfilerOptions) {
		if (!profOpts.enabled) { return Promise.resolve() }
		log.info('creating profiler options file: \'' + uri.fsPath + '\'')

		const opt: string[] = [
			'-profiling',
			'-filename "' + profOpts.filename + '"',
			'-description "' + profOpts.description + '"'
		]

		if (profOpts.coverage) {
			opt.push('-coverage')
		}

		if (this.ablunitConfig.profListingsUri) {
			opt.push('-listings "' + profOpts.listings + '"')
			await this.createDir(this.ablunitConfig.profListingsUri)
		}
		if (profOpts.statistics) {
			opt.push('-statistics')
		}
		if (profOpts.tracing != '') {
			opt.push('-tracing "' + profOpts.tracing + '"')
		}
		if (profOpts.traceFilter != '') {
			opt.push('-traceFilter "' + profOpts.traceFilter + '"')
		}
		await this.deleteFile(this.ablunitConfig.profFilenameUri)
		return this.writeFile(uri, Uint8Array.from(Buffer.from(opt.join('\n') + '\n')))
	}

	createDbConnPf (uri: Uri, dbConns: IDatabaseConnection[]) {
		log.info('creating dbconn.pf: \'' + this.ablunitConfig.dbConnPfUri.fsPath + '\'')
		const lines: string[] = []

		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (dbConns && dbConns.length > 0) {
			for (const conn of dbConns) {
				lines.push(conn.connect)
			}
		}
		if (lines.length > 0) {
			return this.writeFile(uri, Uint8Array.from(Buffer.from(lines.join('\n') + '\n')))
		}
	}

	readPropathFromJson () {
		log.info('reading propath from openedge-project.json')
		const parser: PropathParser = new PropathParser(this.ablunitConfig.workspaceFolder)

		let conf: ProfileConfig | undefined = undefined
		if (this.ablunitConfig.importOpenedgeProjectJson) {
			conf = getOpenEdgeProfileConfig(this.ablunitConfig.workspaceFolder.uri, this.ablunitConfig.openedgeProjectProfile)
		}
		if (conf && conf.buildPath.length > 0) {
			const pathObj: IBuildPathEntry[] = []
			for (const e of conf.buildPath) {
				pathObj.push({
					path: e.path,
					type: e.type.toLowerCase(),
					buildDir: e.buildDir,
					xrefDir: e.xrefDir
				})
			}
			parser.setPropath({ propathEntry: pathObj })
		} else {
			parser.setPropath({ propathEntry: [{
				path: '.',
				type: 'source',
				buildDir: '.',
				xrefDir: '.'
			}]})
		}

		log.info('using propath=\'' + parser.toString() + '\'')
		return parser
	}
}
