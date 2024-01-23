import * as fs from 'fs'
import { Uri } from 'vscode'
// @ts-expect-error 123
import JSON_minify from 'node-json-minify'

export const readStrippedJsonFile = (uri: Uri | string): JSON => {
	if (typeof uri === 'string') {
		uri = Uri.file(uri)
	}
	const contents = fs.readFileSync(uri.fsPath, 'utf8')
	// eslint-disable-next-line
	const ret: JSON = JSON.parse(JSON_minify(contents))
	return ret
}
