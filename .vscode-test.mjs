import { createTestConfig } from './test/createTestConfig.mjs'
import { defineConfig } from '@vscode/test-cli'
import * as fs from 'fs'

// https://github.com/microsoft/vscode-test-cli/issues/48
import { env } from 'process'
delete env['VSCODE_IPC_HOOK_CLI']
env['DONT_PROMPT_WSL_INSTALL'] = true

// console.log('sourceMapsEnabled:', sourceMapsEnabled)
// if (process.sourceMapsEnabled == false) {
//     process.setSourceMapsEnabled(true)
// }
// console.log('sourceMapsEnabled:', sourceMapsEnabled)

function getConfig1() {
    const config = createTestConfig()
    return config
}

function getConfig2() {
    const config = defineConfig({
        tests: [
            {
                extensionDevelopmentPath: '.',
                files: 'test/suites/*.test.ts',
            }
        ],
        coverage: {}
    })
    fs.writeFileSync('.vscode-test.defined.bk.json', JSON.stringify(config, null, 4).replace('    ', '\t'))
    return config
}

function getConfig3() {
    return [
        {
            "path": "d:\\ablunit-test-runner\\.vscode-test.mjs",
            "config": {
                // "platform": "win32",
                "label": "suite:DebugLines",
                "files": "d:\\ablunit-test-runner\\test\\suites\\DebugLines.test.ts",
                "launchArgs": []
            },
            "extensionTestsPath": "d:\\ablunit-test-runner\\node_modules\\@vscode\\test-cli\\out\\runner.cjs",
            "extensionDevelopmentPath": [
                "d:\\ablunit-test-runner"
            ],
            "env": {
                "VSCODE_TEST_OPTIONS": "{\"mochaOpts\":{\"_\":[\"C:\\\\Users\\\\kenne\\\\AppData\\\\Local\\\\Programs\\\\Microsoft VS Code\\\\Code.exe\",\"d:\\\\ablunit-test-runner\\\\node_modules\\\\@vscode\\\\test-cli\\\\out\\\\bin.mjs\"],\"config\":\"d:\\\\ablunit-test-runner\\\\.vscode-test.mjs\",\"list-configuration\":true,\"listConfiguration\":true,\"jobs\":19,\"j\":19,\"slow\":75,\"s\":75,\"timeout\":2000,\"t\":2000,\"diff\":true,\"reporter\":\"spec\",\"R\":\"spec\",\"$0\":\"C:\\\\Users\\\\kenne\\\\AppData\\\\Local\\\\Programs\\\\Microsoft VS Code\\\\Code.exe\"},\"colorDefault\":false,\"preload\":[],\"files\":[\"d:\\\\ablunit-test-runner\\\\test\\\\suites\\\\DebugLines.test.ts\"]}"
            }
        }
    ]
}


export default getConfig1()
// export default getConfig2()
// export default getConfig3()
