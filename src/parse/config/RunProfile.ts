import { WorkspaceFolder } from 'vscode'
import { ICommandOptions, CommandOptions } from './CommandOptions'
import { ICoreOptions, CoreOptions } from './CoreOptions'
import { IProfilerOptions, ProfilerOptions } from './ProfilerOptions'

export interface IRunProfile {
	runProfile?: string
	hide?: boolean
	workspaceFolder?: WorkspaceFolder
	tempDir?: string
	importOpenedgeProjectJson: boolean
	openedgeProjectProfile: string | undefined
	timeout: number
	command?: ICommandOptions
	options?: ICoreOptions
	profiler?: IProfilerOptions
}

export class DefaultRunProfile implements IRunProfile {
	hide = false
	tempDir = '${workspaceFolder}'
	importOpenedgeProjectJson = true
	openedgeProjectProfile: string | undefined = undefined
	timeout = 30000
	command: CommandOptions = new CommandOptions()
	options: CoreOptions = new CoreOptions()
	profiler: ProfilerOptions = new ProfilerOptions()
}
