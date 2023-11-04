import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

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

main();
