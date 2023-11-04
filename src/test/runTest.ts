import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Download VS Code, unzip it and run the integration test
    console.log("await runTests")
    await runTests({
        extensionDevelopmentPath,
        extensionTestsPath,
        launchArgs: [
          'test_projects/proj1',
          // '--disable-extensions',
          // '--disable-gpu',
          // ' --disable-dev-shm-usage',
          // '--no-xshm',
          // '--no-sanbox',
          // '--disable-gpu-sandbox',
          // '--headless', //somewhat works!
        ]
    });
    console.log("runTests complete")
  } catch (err) {
    console.error("ERR: " + err);
    console.error('Failed to run tests');
    process.exit(1);
  }
}

console.log("main start")
main();
console.log("main end")
