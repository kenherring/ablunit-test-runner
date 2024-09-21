import { Uri, workspace } from 'vscode'
import { TextDecoder } from 'util'
import { log } from '../ChannelLogger'

const textDecoder = new TextDecoder('utf-8')
export function getContentFromFilesystem (uri: Uri) {
	log.info('700')
	const v = workspace.fs.readFile(uri)
		.then((rawContent) => {
			log.info('701')
			return textDecoder.decode(rawContent)
		}, (e) => {
			log.info('799')
			log.warn('Error providing tests for ' + uri.fsPath + ': ' + e)
			return ''
		})
	log.info('702 v=' + JSON.stringify(v))
	return v
}

export function getLines (text: string, annotation: string): [ string[], boolean ] {
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
