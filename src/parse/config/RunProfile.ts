import { WorkspaceFolder } from 'vscode'
import { ICommandOptions, CommandOptions } from 'parse/config/CommandOptions'
import { ICoreOptions, CoreOptions } from 'parse/config/CoreOptions'
import { IProfilerOptions, ProfilerOptions } from 'parse/config/ProfilerOptions'

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
	initializationProcedure?: string
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
