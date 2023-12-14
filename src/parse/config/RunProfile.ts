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
	profiler?: IProfilerOptions
}

export class DefaultRunProfile implements IRunProfile {
	hide: boolean = false
	tempDir: string = "${workspaceFolder}"
	importOpenEdgeProjectJson: boolean = true
	command: CommandOptions = new CommandOptions()
	options: CoreOptions = new CoreOptions()
	profiler: ProfilerOptions = new ProfilerOptions()
}
