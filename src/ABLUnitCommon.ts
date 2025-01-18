import { TestController, TestItem, TestItemCollection, Uri } from 'vscode'
import { ABLResults } from './ABLResults'
import * as FileUtils from './FileUtils'

export interface IExtensionTestReferences {
	testController: TestController
	recentResults: ABLResults[]
	currentRunData: ABLResults[]
	recentError: Error | undefined
}

export class Duration {
	name?: string
	start: number
	end: number
	runtime?: number
	private stopped = false
	constructor (name?: string) {
		this.name = name
		this.start = Date.now()
		this.end = this.start
	}

	reset () {
		this.start = Date.now()
		this.end = this.start
		this.stopped = false
	}

	elapsed = () => {
		if (!this.stopped) {
			this.end = Date.now()
		}
		return this.end - this.start
	}

	stop () {
		this.end = Date.now()
		this.stopped = true
		this.runtime = this.end - this.start
	}

	toString () {
		return '(duration=' + this.elapsed() + 'ms)'
	}
}

export function readOEVersionFile (useDLC: string) {
	const dlcUri = Uri.file(useDLC)
	const versionFileUri = Uri.joinPath(dlcUri, 'version')
	if (!FileUtils.doesFileExist(versionFileUri)) {
		// log.debug('version file does not exist: ' + versionFile)
		return undefined
	}
	const dlcVersion = FileUtils.readFileSync(versionFileUri)
	if (!dlcVersion) {
		// log.debug('failed to read version file: ' + versionFile)
		return undefined
	}

	const match = RegExp(/OpenEdge Release (\d+\.\d+)/).exec(dlcVersion.toString())
	if (match) {
		// log.info('oeversion from DLC is ' + match[1] + ' (file=' + versionFile + ')')
		return match[1]
	}
	// log.debug('failed to parse version file: ' + versionFile + ' (content=' + dlcVersion + ')')
	return undefined
}

export function gatherAllTestItems (collection: TestItemCollection) {
	const items: TestItem[] = []
	collection.forEach(item => {
		items.push(item, ...gatherAllTestItems(item.children))
	})
	return items
}
