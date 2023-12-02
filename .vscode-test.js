const { defineConfig } = require('@vscode/test-cli')
const { getTestConfig } = require('./out/test/createTestConfig')

module.exports = defineConfig(getTestConfig())
