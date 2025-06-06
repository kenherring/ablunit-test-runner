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

export interface IErrorStatusMessage {
	message: string
	messageNumber: number
}

export interface IErrorStatus {
	error: boolean
	instantiatingProcedure: string
	numMessages: number
	type: string
	messages: IErrorStatusMessage[]
}

export interface ICompilerErrorMessage {
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

export interface ICompilerError {
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
	messages: ICompilerErrorMessage[]
}

function mergeMessagesByPosition (messages: ICompilerErrorMessage[]): ICompilerErrorMessage[] {
	for (let i=0; i<messages.length-2; i++) {
		const m = messages[i]
		while (messages[i+1].row == m.row && messages[i+1].column == m.column) {
			m.message += '\n' + messages[i+1].message
			messages.splice(i+1, 1)
		}
	}
	return messages
}

export class ABLCompilerError extends ABLUnitRuntimeError {
	constructor (public compilerErrors: ICompilerError[], cmd?: string) {
		super('compile error count=' + compilerErrors.length, '<message>', cmd)
		this.name = 'ABLCompilerError'
		for (const i of compilerErrors) {
			try {
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

	constructor (message: string, duration: Duration, limit: number, cmd?: string) {
		super(message)
		this.message = message + ' (' + duration.elapsed() + 'ms > ' + limit + 'ms)'
		this.name = 'TimeoutError'
		this.duration = duration
		this.limit = limit
		this.cmd = cmd
	}
}
