const { defineConfig } = require('@vscode/test-cli')
const fs = require('fs')


// Generate .vscode-test.config.json by running this script:
//   node ./out/test/createTestConfig.js

const testConfig = JSON.parse(fs.readFileSync('./.vscode-test.config.json', 'utf8'))
module.exports = defineConfig(testConfig)
