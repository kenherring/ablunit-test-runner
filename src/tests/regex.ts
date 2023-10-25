
function xrefTest () {
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
}

function profileSection1_test () {
	// const summaryRE = /^(\d+) (\d{2}\/\d{2}\/\d{4}) "([^"]*)" (\d{2}:\d{2}:\d{2}) "([^"]*)""/
	const summaryRE = /^(\d+) (\d{2}\/\d{2}\/\d{4}) "([^"]*)" (\d{2}:\d{2}:\d{2}) "([^"]*)" (.*)$/
	let line = '3 10/15/2023 "ABLUnit" 15:49:04 "" {"StmtCnt":4211,"DataPts":8486,"NumWrites":0,"TotTime":0.134264,"BufferSize":61440,"Directory":"c:\\git\\ablunit-test-provider\\test_projects\\proj5_propath\\target\\listings\\","Propath":"src,path,C:\\Progress\\OpenEdge\\tty,C:\\Progress\\OpenEdge\\tty\\ablunit.pl,C:\\Progress\\OpenEdge\\tty\\adecomm.pl,C:\\Progress\\OpenEdge\\tty\\adecomp.pl,C:\\Progress\\OpenEdge\\tty\\adeedit.pl,C:\\Progress\\OpenEdge\\tty\\adeshar.pl,C:\\Progress\\OpenEdge\\tty\\dataadmin.pl,C:\\Progress\\OpenEdge\\tty\\OpenEdge.BusinessLogic.pl,C:\\Progress\\OpenEdge\\tty\\OpenEdge.Core.pl,C:\\Progress\\OpenEdge\\tty\\OpenEdge.ServerAdmin.pl,C:\\Progress\\OpenEdge\\tty\\prodict.pl,C:\\Progress\\OpenEdge,C:\\Progress\\OpenEdge\\bin"}'
	console.log("1: " + line)
	line = line.replace(/\\/g,'/')
	console.log("2: " + line)
	const res = summaryRE.exec(line)
	if (res) {
		console.log("1: " + res[1])
		console.log("6: " + res[6])
		const json = JSON.parse(res[6])
		console.log("7:" + json.Propath)
	} else {
		console.error("regex doesn't match!")
	}
}

// profileSection1_test()

interface ITestInt {
	name: string,
	properties: {[key: string]: string}
}

function testJson () {
	const  nv: ITestInt = {
		name: "ken",
		properties: {
			"prop1": "val1",
			"prop2": "val2"
		}
	}
}

testJson()
