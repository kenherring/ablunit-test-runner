import { DeclarationCoverage, Position, Range, StatementCoverage, TestController, TestItem, TestItemCollection, Uri } from 'vscode'
import { ABLResults } from 'ABLResults'
import * as FileUtils from 'FileUtils'
import { log } from 'ChannelLogger'

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

export function gatherAllTestItems (collection: TestItemCollection | TestItem[]) {
	const items: TestItem[] = []
	collection.forEach(item => {
		items.push(item, ...gatherAllTestItems(item.children))
	})
	return items
}

export function sortLocation (a: DeclarationCoverage | StatementCoverage, b: DeclarationCoverage | StatementCoverage) {
	let startPosA: Position
	let startPosB: Position
	let endPosA: Position | undefined
	let endPosB: Position | undefined

	if (a.location instanceof Range) {
		startPosA = a.location.start
		endPosA = a.location.end
	} else if (a.location instanceof Position) {
		startPosA = a.location
		endPosA = a.location
	} else {
		log.error('Invalid location type, expected Position | Range: ' + JSON.stringify(a.location))
		throw new Error('Invalid location type, expected Position | Range: ' + JSON.stringify(a.location))
	}
	if (b.location instanceof Range) {
		startPosB = b.location.start
		endPosB = b.location.end
	} else if (b.location instanceof Position) {
		startPosB = b.location
		endPosB = b.location
	} else {
		log.error('Invalid location type, expected Position | Range: ' + JSON.stringify(b.location))
		throw new Error('Invalid location type, expected Position | Range: ' + JSON.stringify(b.location))
	}

	const comp = startPosA.compareTo(startPosB)
	if (comp != 0) {
		return comp
	}
	return endPosA.compareTo(endPosB)

}
