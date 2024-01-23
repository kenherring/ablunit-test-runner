const { defineConfig } = require('@vscode/test-cli')
const fs = require('fs')

// const { getTestConfig } = require('./out/test/createTestConfig')
// module.exports = defineConfig(getTestConfig())
const configFile = __dirname + '/.vscode-test.config.json'
const testConfigJson = JSON.parse(fs.readFileSync(configFile, 'utf8'))
// const testConfigJson: IDesktopTestConfiguration[] = JSON.parse(fs.readFileSync(configFile, 'utf8'))

// console.log("testConfig=" + testConfig)

module.exports = defineConfig(JSON.stringify(testConfigJson.testConfig))
