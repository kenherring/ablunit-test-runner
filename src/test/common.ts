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

export async function getTestCount(resultsJson: Uri) {
	const count = await workspace.fs.readFile(resultsJson).then((content) => {
		const str = Buffer.from(content.buffer).toString();
		const results = JSON.parse(str)
		return results[0].tests
	})
	return count
}
