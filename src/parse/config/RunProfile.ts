import { WorkspaceFolder } from 'vscode'
import { ICommandOptions, CommandOptions } from './CommandOptions'
import { ICoreOptions, CoreOptions } from './CoreOptions'
import { IProfilerOptions, ProfilerOptions } from './ProfilerOptions'

export interface IRunProfile {
	runProfile?: string
	hide?: boolean
	workspaceFolder?: WorkspaceFolder
	tempDir?: string
	importOpenEdgeProjectJson: boolean
	command?: ICommandOptions
	options?: ICoreOptions
	profilerOpts?: IProfilerOptions
}

export class DefaultRunProfile implements IRunProfile {
	hide: boolean = false
	tempDir: string = "${extensionContextStorage}"
	importOpenEdgeProjectJson: boolean = true
	command: CommandOptions = new CommandOptions()
	options: CoreOptions = new CoreOptions()
	profilerOpts: ProfilerOptions = new ProfilerOptions()
}

// export const DefaultRunProfile: IRunProfile = {
// 	hide: false,
// 	tempDir: "${extensionContextStorage}",
// 	importOpenEdgeProjectJson: true,
// 	command: {
// 		executable: "${DLC}/_progres",
// 		progressIni: "progress.ini",
// 		batch: true,
// 		additionalArgs: []
// 	},
// 	options: {
// 		output: {
// 			location: "${tempDir}",
// 			filename: "results",
// 			format: "xml",
// 			writeJson: false
// 		},
// 		quitOnEnd: true,
// 		writeLog:  false,
// 		showErrorMessage: true,
// 		throwError: true
// 	},
// 	profilerOpts: {
// 		enabled: true,
// 		coverage: true,
// 		description: "Run via VSCode - ABLUnit Test Provider Extension",
// 		filename: "prof.out",
// 		listings: 'listings',
// 		statistics: false,
// 		traceFilter: "",
// 		tracing: '',
// 		writeJson: false
// 	}
// }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class RunProfile extends DefaultRunProfile {
	hide: boolean = false
	tempDir: string = "${extensionContextStorage}"
	importOpenEdgeProjectJson: boolean = true
	command: CommandOptions = new CommandOptions()
	options: CoreOptions = new CoreOptions()
	profiler: ProfilerOptions = new ProfilerOptions()
}
