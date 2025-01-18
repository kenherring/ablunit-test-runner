import { Duration } from 'ABLUnitCommon'

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
