
export interface IXrefOptions {
	useXref: boolean, // default false
	xrefLocation: string, // default: ${workspaceFolder}
	xrefExtension: string, // default: xref
	xrefThrowError: boolean, // default: false
}

export class XrefOptions implements IXrefOptions {
	public useXref = false
	public xrefLocation = ''
	public xrefExtension = 'xref'
	public xrefThrowError = false

	merge (from?: IXrefOptions) {
		if (from === undefined) {
			return this
		}
		this.useXref = from.useXref ?? this.useXref
		this.xrefLocation = from.xrefLocation ?? this.xrefLocation
		this.xrefExtension = from.xrefExtension ?? this.xrefExtension
		this.xrefThrowError = from.xrefThrowError ?? this.xrefThrowError
	}
}
