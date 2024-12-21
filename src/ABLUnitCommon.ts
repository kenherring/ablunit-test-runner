import { TestController, TestItem, TestItemCollection } from 'vscode'
import { ABLResults } from './ABLResults'

export interface IExtensionTestReferences {
	testController: TestController
	recentResults: ABLResults[]
	currentRunData: ABLResults[]
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

export function gatherAllTestItems (collection: TestItemCollection) {
	const items: TestItem[] = []
	collection.forEach(item => {
		items.push(item, ...gatherAllTestItems(item.children))
	})
	return items
}
