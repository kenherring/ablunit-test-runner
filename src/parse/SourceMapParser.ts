import { Uri } from 'vscode'
import * as FileUtils from 'FileUtils'

export interface ISources {
	sourceName: string,
	sourceNum: number | undefined
	sourceUri: Uri
}

export interface IIncludeMap {
	sourceLine: number,
	sourceNum: number,
	sourcePath: string,
	sourceUri: Uri
	debugLine: number,
	debugUri: Uri,
}

export interface IDeclarations { // method, procedure, function, constructor, etc
	procLoc: number,
	procName: string,
	procNum: number,
	lineCount: number,
	lines: number[] | undefined
}

export enum SignatureType {
	Main = 'MAIN',
	Procedure = 'PROC',
	Constructor = 'CONST',
	Destructor = 'DEST',
	// PropertyGet = 'PGET',
	// PropertySet = 'PSET',
	Method = 'METH',
	TempTable = 'TTAB',
	DataSet = 'DSET',

	Unknown = 'UNKOWN'
}

export enum SignatureAccessMode {
	Public = 1,
	Protected = 2,
	Unknown = 3,
	Private = 4,
}

export enum ParameterMode {
	Input = 1,
	Output = 2,
	InputOutput = 3,
}

export enum ParameterType {
	Void = 0,
	Character = 1,
	Integer = 4,
}

export function getShortTypeText (type: ParameterType): string {
	switch (type) {
		case ParameterType.Void:
			return 'void'
		case ParameterType.Character:
			return 'char'
		case ParameterType.Integer:
			return 'int'
		default:
			return 'unknown'
	}
}

interface ISignatureParameter {
	_raw: string
	mode: ParameterMode
	name: string
	type: ParameterType
	unknown4?: string
}

export interface ISignature {
	_raw: string
	type: SignatureType
	name: string
	accessMode: SignatureAccessMode,
	returns: ParameterType,
	returnTBD: string,
	parameters: ISignatureParameter[]
}

export class SourceMap {
	readonly modified: Date
	items: SourceMapItem[] = []
	sources: ISources[] = []
	includes: IIncludeMap[] = []
	declarations: IDeclarations[] = []
	signatures: ISignature[] = []
	crc?: number

	constructor (public readonly sourceUri: Uri, public readonly path: string, public readonly processingMethod: 'rcode' | 'xref') {
		this.modified = FileUtils.getFileModifiedTime(sourceUri)
	}
}

interface ISourceMapItem {
	debugLine: number
	debugUri: Uri
	sourceLine: number
	sourceUri: Uri
	procName: string
	procNum?: number
	executable?: boolean
}

export class SourceMapItem {
	debugLine: number
	debugUri: Uri
	sourceLine: number
	sourceUri: Uri
	procName: string
	procNum?: number
	executable?: boolean

	get sourcePath () {
		return this.sourceUri.fsPath
	}

	constructor (data: ISourceMapItem) {
		this.debugLine = data.debugLine
		this.debugUri = data.debugUri
		this.sourceLine = data.sourceLine
		this.sourceUri = data.sourceUri
		this.procName = data.procName
		this.procNum = data.procNum
		this.executable = data.executable ?? false
	}

	toJSON () {
		return {
			debugLine: this.debugLine,
			debugPath: this.debugUri.fsPath,
			sourceLine: this.sourceLine,
			sourcePath: this.sourceUri.fsPath,
			procName: this.procName
		}
	}

}
