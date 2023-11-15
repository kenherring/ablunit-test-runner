import { FileType, Uri, workspace } from 'vscode'

export async function doesFileExist(uri: Uri) {
	const ret = await workspace.fs.stat(uri).then((stat) => {
		if (stat.type === FileType.File) {
			return true
		}
		return false
	}, (err) => {
		return false
	})
	return ret
}
