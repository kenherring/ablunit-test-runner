// // Generate .vscode-test.config.json by running this script:
// //   node ./out/test/createTestConfig.js
// const fs = require('fs')
// const testConfig = JSON.parse(fs.readFileSync('./.vscode-test.config.json', 'utf8'))

const { createTestConfig } = require('./out/test/createTestConfig')
const testConfig = createTestConfig()

const { defineConfig } = require('@vscode/test-cli')
module.exports = defineConfig(testConfig)
