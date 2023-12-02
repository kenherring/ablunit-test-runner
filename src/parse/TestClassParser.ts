import { Position, Range, Uri, workspace } from 'vscode'
import { logToChannel } from '../ABLUnitCommon'
import { getLines } from './TestParserCommon'

// CLASS statement
const classRE = /^\s*class\s+(\S+[^:])\s*/i
// METHOD statement
const methodRE = /\s+method\s(\s*public)?\s*void\s*(\S+\w)/i
// const methodRE = /\s+method\s(\s*public)?\s*void\s*(\S[^\s:(]+)/i

export const parseABLTestClass = (text: string, relativePath: string, events: {
	deleteTest(): void
	onTestProgramDirectory (range: Range, dirpath: string, dir: string, dirUri: Uri): void
	onTestClass(range: Range, relativePath: string, classname: string, label: string, suiteName?: string): void
	onTestMethod(range: Range, relativePath: string, classname: string, methodname: string): void
}) => {
	relativePath = relativePath.replace(/\\/g, '/')
	logToChannel("parsing " + relativePath)

	const [lines, foundAnnotation] = getLines(text, "@test")
	if(!foundAnnotation) {
		events.deleteTest()
		return
	}

	const configClassLabel = workspace.getConfiguration('ablunit').get('display.classLabel','')
	if (!workspace.workspaceFolders) {
		return
	}
	const workspaceDir = workspace.workspaceFolders.map(item => item.uri)[0]
	const zeroRange = new Range(new Position(0,0), new Position(0,0))

	const parseClass = () => {
		const classRet = parseTestClass(lines, configClassLabel, relativePath, workspaceDir)
		if (classRet.methods.length == 0) {
			return
		}

		for(const testProgramDir of classRet.testProgramDirs) {
			if(testProgramDir) {
				events.onTestProgramDirectory(zeroRange, testProgramDir.relativeTree, testProgramDir.part, testProgramDir.uri)
			}
		}
		events.onTestClass(classRet.range, relativePath, classRet.classname, classRet.label)
		for(const method of classRet.methods) {
			if(method) {
				events.onTestMethod(method.range, relativePath, classRet.classname, method.methodname)
			}
		}
	}

	parseClass()
}

interface ITree {
	relativeTree: string,
	part: string,
	uri: Uri
}

interface IClassRet {
	classname: string
	label: string
	range: Range
	testProgramDirs: ITree[]
	methods: [{
		methodname: string,
		range: Range
	}?]
}

function getTestProgramDirs (workspaceDir: Uri, parts: string[]) {
	let relativeTree = ""
	const ret: ITree[] = []

	for (let idx=0; idx < parts.length - 1; idx++) {
		if (relativeTree == "") {
			relativeTree = parts[idx]
		} else {
			relativeTree = relativeTree + '/' + parts[idx]
		}
		ret.push({
			relativeTree: relativeTree,
			part: parts[idx],
			uri: Uri.joinPath(workspaceDir,relativeTree)
		})
	}
	return ret
}

export function parseTestClass (lines: string[], configClassLabel: string, relativePath: string, workspaceDir: Uri) {
	let foundClassHead = false
	const classRet: IClassRet = {
		classname: "",
		label: "",
		range: new Range(new Position(0,0), new Position(0,0)),
		testProgramDirs: [],
		methods: []
	}

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		if (lines[lineNo] === "") {
			continue
		}

		//first find the class statement
		if (!foundClassHead) {
			const classResult = classRE.exec(lines[lineNo])
			if (classResult) {
				classRet.classname = classResult[1].replace(/:$/,'').trim()
				const range = new Range(new Position(lineNo, lines[lineNo].indexOf(classRet.classname)), new Position(lineNo, classRet.classname.length))

				const parts = relativePath.split('/')
				classRet.testProgramDirs = getTestProgramDirs(workspaceDir, parts)
				classRet.label = parts[parts.length - 1]

				classRet.range = range
				foundClassHead = true
				continue
			}
		} else if (lines[lineNo - 1].toLowerCase().indexOf("@test.") != -1) {
			const method = methodRE.exec(lines[lineNo])
			if (method) {
				const [, , methodname] = method
				const range = new Range(new Position(lineNo, 0), new Position(lineNo, method[0].length))
				classRet.methods?.push({methodname: methodname, range: range})
				continue
			}
		}
	}

	if (configClassLabel == "filepath") {
		classRet.classname = relativePath
	}
	return classRet
}
