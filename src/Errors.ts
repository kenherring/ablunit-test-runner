import { Duration } from 'ABLUnitCommon'
import { log } from 'ChannelLogger'

export class NotImplementedError extends Error {
	constructor (message: string) {
		super(message)
		this.name = 'NotImplementedError'
	}
}

export class ABLUnitRuntimeError extends Error {
	constructor (message: string, public promsgError: string, public cmd?: string) {
		super(message)
		this.name = 'ABLUnitRuntimeError'
	}
}

export interface ICompileMessage {
	column: number
	errorColumn: number
	errorRow: number
	fileName: string
	fileOffset: number
	message: string
	messageType: string
	number: number
	row: number
}

export interface ICompileError {
	name: string,
	classType: string
	error: boolean
	errorColumn: number
	errorRow: number
	fileName: string
	fileOffset: number
	instantiatingProcedure?: string | null
	multiCompile: boolean
	numMessages: number
	optionsRaw: string
	stopped: boolean
	type: string
	warning: boolean
	messages: ICompileMessage[]
}

function mergeMessagesByPosition (messages: ICompileMessage[]): ICompileMessage[] {
	let i = 0
	for (const m of messages) {
		log.info('i=' + i)
		while (messages[i+1].row == m.row && messages[i+1].column == m.column) {
			m.message += '\n' + messages[i+1].message
			messages.splice(i+1, 1)
		}
		i = i + 1
	}
	return messages
}

export class ABLCompileError extends ABLUnitRuntimeError {
	constructor (public compileErrors: ICompileError[], cmd?: string) {
		super('compile error count=' + compileErrors.length, compileErrors[0].messages[0].message, cmd)
		this.name = 'ABLCompileError'
		for (const i of compileErrors) {
			try {
				// i.messages = mergeMessagesByPosition(i.messages)
				mergeMessagesByPosition(i.messages)
			} catch (e) {
				log.error('error=' + e)
			}
		}
	}
}

export interface ITimeoutError extends Error {
	duration: Duration
	limit: number
	cmd?: string
}

export class TimeoutError extends Error implements ITimeoutError {
	duration: Duration
	limit: number
	cmd?: string

	constructor (message: string, duration: Duration, limit: number, cmd: string) {
		super(message)
		this.name = 'TimeoutError'
		this.duration = duration
		this.limit = limit
		this.cmd = cmd
	}
}
