import { Uri, workspace } from 'vscode'
import { TextDecoder } from 'util'
import { isRelativePath } from 'ABLUnitCommon'
import * as fs from 'fs'

const textDecoder = new TextDecoder('utf-8')

function toUri (uri: Uri | string): Uri {
	if (uri instanceof Uri) {
		return uri
	}
	const filename = uri

	if (!isRelativePath(uri)) {
		return Uri.file(uri)
	}

	if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
		throw new Error('No workspace folder found')
	}
	for (const wf of workspace.workspaceFolders) {
		uri = Uri.joinPath(wf.uri, filename)
		if (fs.statSync(uri.fsPath).isFile()) {
			return uri
		}
	}
	throw new Error('relative file not found in any workspace: ' + filename)
}

export function getContentFromFilesystem (uri: Uri | string) {
	uri = toUri(uri)
	return workspace.fs.readFile(uri)
		.then((rawContent) => { return textDecoder.decode(rawContent) },
			(e: unknown) => { throw e })
}

export function readLinesFromFile (uri: Uri | string) {
	uri = toUri(uri)
	return getContentFromFilesystem(uri)
		.then((content) => {
			// split lines, remove CR and filter out empty lines
			return content.replace(/\r/g, '').split('\n').filter((line) => line.trim().length > 0)
		})
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
