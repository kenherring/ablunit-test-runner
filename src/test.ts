
const fs = require('fs');
var content = fs.readFileSync("C:\\Progress\\OpenEdge\\prohelp\\msgdata\\msg287", "utf8")

console.log(content.split("\n")[0])

const reg = /^(\d+) "[\s\S]+?"/g
console.log(1)

var m = content.matchAll(reg)
var count = 0

for (let idx=0 ; idx<content.length; idx++) {
	const m2 = m[idx]
	console.log(idx + " " + m2.length)
}

// var m = reg.exec(content)
// console.log(2 + " " + m)
// while (m) {
// 	console.log("reg.length=" + m.length + " " + m)
// 	content = content.substring(m[0].length)
// 	m = reg.exec(content)
// 	console.log(m)
// }
