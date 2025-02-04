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

export class ABLCompilerError extends ABLUnitRuntimeError {
	constructor (public compilerErrors: ICompilerError[], cmd?: string) {
		super('compile error count=' + compilerErrors.length, '<message>', cmd)
		log.info('200 ' + compilerErrors.length)
		log.info('201 ' + compilerErrors[0].messages.length)
		log.info('202 ' + compilerErrors[0].messages[0].messageType + ' ' + compilerErrors[0].messages[0].message)
		this.name = 'ABLCompilerError'
		log.info('203')
		for (const i of compilerErrors) {
			log.info('204 ' + JSON.stringify(i, null, 2))
			try {
				log.info('205')
				mergeMessagesByPosition(i.messages)
				log.info('206')
			} catch (e) {
				log.info('207')
				log.error('error=' + e)
				log.info('208')
			}
			log.info('209')
		}
		log.info('210')
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
		this.name = 'TimeoutError'
		this.duration = duration
		this.limit = limit
		this.cmd = cmd
	}
}
