const { defineConfig } = require('@vscode/test-cli')
const fs = require('fs')
const { createTestConfig } = require('./out/test/createTestConfig')

// Generate .vscode-test.config.json by running this script:
//   node ./out/test/createTestConfig.js
// const testConfig = JSON.parse(fs.readFileSync('./.vscode-test.config.json', 'utf8'))

const testConfig = createTestConfig()
module.exports = defineConfig(testConfig)
