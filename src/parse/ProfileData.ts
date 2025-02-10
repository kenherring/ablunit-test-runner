import { Uri } from 'vscode'

class IObject {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	propname?: any
}

export class ProfileData {
	data: IObject
	constructor (data: string) {
		this.data = JSON.parse(data) as IObject
	}

	convertUris (data: IObject) {
		for (const key of Object.keys(data)) {
			if (typeof data[key] !== 'object') {
				continue
			}

			if (data[key] instanceof Array) {
				for (const element of data[key]) {
					this.convertUris(element as IObject)
				}
				continue
			}

			try {
				const d = data[key] as Uri
				data[key] = d.fsPath
			} catch (_e: unknown) {
				this.convertUris(data[key] as IObject)
			}
		}
		return data
	}

	toJSON () {
		return this.convertUris(this.data)
	}

}
