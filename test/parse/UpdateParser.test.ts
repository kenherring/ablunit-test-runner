import { assert } from '../testCommon'
import { parseUpdates, TestStatus } from 'parse/UpdateParser'


suite ('UpdateParser', () => {

	test('parseUpdateLines - readFile', () => {
		return parseUpdates('../../test/resources/UpdateParserTest1.txt')
			.then((updates) => {
				if (!updates) {
					assert.fail('updates is undefined')
					return
				}
				for (const item of updates) {
					assert.equal(item.status, TestStatus.passed, 'item.id=' + item.id + '; item.name=' + item.name)
				}
				return
			}, (e) => { throw e })
	})

})
