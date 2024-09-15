import { Uri, workspace } from 'vscode'
import { TextDecoder } from 'util'
import { isRelativePath } from 'ABLUnitCommon'

const textDecoder = new TextDecoder('utf-8')

function toUri (uri: Uri | string): Uri {
	if (typeof uri === 'string') {
		if (isRelativePath(uri)) {
			if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
				throw new Error('No workspace folder found')
			}
			uri = Uri.joinPath(workspace.workspaceFolders[0].uri, uri)
		} else {
			uri = Uri.file(uri)
		}
	}
	return uri
}

export function getContentFromFilesystem (uri: Uri | string) {
	uri = toUri(uri)
	const textDecoder = new TextDecoder('utf-8')
	return workspace.fs.readFile(uri)
		.then((rawContent) => { return textDecoder.decode(rawContent) },
			(e) => { throw e })
}

export function readLinesFromFile (uri: Uri | string) {
	uri = toUri(uri)
	return getContentFromFilesystem(uri)
		.then((content) => { return content.replace(/\r/g, '').split('\n') })
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
		lines[i] = removeComments(lines[i])

		if (lines[i].trim() == '') {
			// set empty lines to empty string
			lines[i] = ''
		} else if (!foundAnnotation && lines[i].toLowerCase().includes('@test')) {
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
	line = line.replace(/\/\/.*/g, '') // trim end of line comments

	const matches = blockCommentRE.exec(line)
	if(!matches) { return line }

	for(const element of matches) {
		line = line.replace(element, ' '.repeat(element.length))
	}
	return line
}
