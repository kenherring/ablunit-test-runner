import { WorkspaceFolder } from 'vscode'
import { ICommandOptions, CommandOptions } from './CommandOptions'
import { ICoreOptions, CoreOptions } from './CoreOptions'
import { IProfilerOptions, ProfilerOptions } from './ProfilerOptions'
import { IXrefOptions, XrefOptions } from './XrefOptions'

export interface IRunProfile {
	runProfile?: string
	hide?: boolean
	workspaceFolder?: WorkspaceFolder
	tempDir?: string
	importOpenedgeProjectJson: boolean
	openedgeProjectProfile: string | undefined
	command?: ICommandOptions
	options?: ICoreOptions
	profiler?: IProfilerOptions
	xref?: IXrefOptions
}

export class DefaultRunProfile implements IRunProfile {
	hide = false
	tempDir = '${workspaceFolder}'
	importOpenedgeProjectJson = true
	openedgeProjectProfile: string | undefined = undefined
	command: CommandOptions = new CommandOptions()
	options: CoreOptions = new CoreOptions()
	profiler: ProfilerOptions = new ProfilerOptions()
	xref: XrefOptions = new XrefOptions()
}
