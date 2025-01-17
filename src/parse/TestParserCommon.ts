import { Uri, workspace } from 'vscode'
import { TextDecoder } from 'util'
import * as fs from 'fs'
import * as FileUtils from '../FileUtils'

const textDecoder = new TextDecoder('utf-8')

function toUri (pathOrUri: Uri | string): Uri {
	if (pathOrUri instanceof Uri) {
		return pathOrUri
	}
	const path = pathOrUri

	if (!FileUtils.isRelativePath(path)) {
		return Uri.file(path)
	}

	if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
		throw new Error('No workspace folder found')
	}
	for (const wf of workspace.workspaceFolders) {
		const uri = Uri.joinPath(wf.uri, path)
		if (fs.statSync(uri.fsPath).isFile()) {
			return uri
		}
	}
	throw new Error('Relative path not found in any workspace: ' + path)
}

export function getContentFromFilesystem (uri: Uri | string) {
	uri = toUri(uri)
	return workspace.fs.readFile(uri)
		.then((rawContent) => { return textDecoder.decode(rawContent)
		}, (e: unknown) => { throw e })
}

export function getAnnotationLines (text: string, annotation: string): [ string[], boolean ] {
	const annotationRegex = new RegExp(annotation, 'i')

	if (!annotationRegex.test(text)) {
		// no annotation found
		const lines: string[] = []
		return [ lines, false ]
	}

	// found an annotation, but this only means we have the text in the file.
	// the file could still not contain tests because the matched text is in
	// comments, strings, etc.  so, we'll parse the file to find out.

	const lines = text.replace(/\r/g, '').split('\n')
	let foundAnnotation = false
	for (let i = 0; i < lines.length; i++) {
		lines[i] = removeComments(lines[i]).trim()

		if (!foundAnnotation && lines[i].toLowerCase().includes('@test')) {
			foundAnnotation = true
		}
	}
	if (lines.length == 0) {
		return [ lines, false ]
	}
	return [ lines, foundAnnotation ]
}

const blockCommentRE = /\/\*.*\*\//g

function removeComments (line: string) {
	line = line.replace(/\/\/.*$/g, '') // trim end of line comments

	const matches = blockCommentRE.exec(line)
	if(!matches) {
		return line.trim()
	}

	for(const element of matches) {
		line = line.replace(element, ' '.repeat(element.length))
	}
	return line.trim()
}
