// import * as vscode from 'vscode'
console.log("STARTED abunitTestSuites.test.js")

// import { setupSuite } from './suites/setup.test'
// import { simpleTestSuite } from './suites/simpleTest.test'
// import { proj1Suite } from './suites/proj1.test'

// module.exports = {
//     setupSuite,
//     simpleTestSuite,
//     proj1Suite
// }

const suites = [ require('suites/setup.test') ]
suites.push(require('suites/simpleTest.test'))
suites.push(require('suites/proj1.test'))

// suites = [ require('./suites/setup.test')]
// suites.push(require('./suites/simpleTest.test'))
// console.log("start glob")
// require('./suites/*.test')

// try {
//   const res = await glob(__dirname + '/**/*.ts');
//   suites = Promise.all(res.map((file) => (
//     import(file.replace(__dirname, '.').replace('.ts', ''))
//   )));
// } catch (err) {
//   // handle `err`
// }

// use `modules`

// console.log("path=" + path.resolve(__dirname, 'suites'))
// for (const file of glob.globSync(path.resolve(__dirname, 'suites', '*.test.ts'))) {
//     console.log("file=" + file)
//     const testSuite = require('./' + file.replace(/.ts$/, ''))
//     suites.push(testSuite)
//     break
// //     // if (!suites) {
// //     //     suites = [require(`../${file}`)]
// //     // // } else {
// //     // //     suites.push(require(`../${file}`))
// //     // }
// }

module.exports = suites

console.log("FINISHED abunitTestSuites.test.js")
