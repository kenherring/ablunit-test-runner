
const line = '.\\testfile.p .\\include1.i 7 INCLUDE "                 include2.i         "'
const incRE = /(\S+) (\S+) (\d+) ([A-Z-]+) (".*"|\S+)/
const res = incRE.exec(line)
if(res) {
	const [,source,include,lineNumStr,xrefType,includeNameRaw] = res
	const includeName = includeNameRaw.replace(/^"(.*)"$/, '$1').trim()
	const expected = 'include2.i'

	console.log("res[1]=" + res[1])
	console.log("res[2]=" + res[2])
	console.log("res[3]=" + res[3])
	console.log("res[4]=" + res[4])
	console.log("res[5]=" + res[5])

	if (includeName != expected) {
		console.log("exp: " + expected)
		console.log("got: " + includeName)
	} else {
		console.log("match! '" + includeName + "'")
	}
}