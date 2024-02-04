// // Generate .vscode-test.config.json by running this script:
// //   node ./out/test/createTestConfig.js
// const fs = require('fs')
// const testConfig = JSON.parse(fs.readFileSync('./.vscode-test.config.json', 'utf8'))

const { getTestConfig } = require('./out/test/createTestConfig')
const testConfig = getTestConfig()

const { defineConfig } = require('@vscode/test-cli')
// const fs = require('fs')
// fs.writeFileSync('./.vscode-test.defined.json', JSON.stringify(defineConfig(testConfig), null, 4) + '\n')
module.exports = defineConfig(testConfig)
