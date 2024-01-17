const { defineConfig } = require('@vscode/test-cli')
const fs = require('fs')

// const { getTestConfig } = require('./out/test/createTestConfig')
// module.exports = defineConfig(getTestConfig())

const testConfig = JSON.parse(fs.readFileSync('./.vscode-test.config.json', 'utf8'))
module.exports = defineConfig(testConfig)
