let version = 'stable'
if (process.argv.includes('--insiders')) {
    version = 'insiders'
}

const { getTestConfig } = require('./out/test/createTestConfig')
const testConfigStable = getTestConfig('stable')
const testConfig = testConfigStable

const { defineConfig } = require('@vscode/test-cli')
module.exports = defineConfig(testConfig)
