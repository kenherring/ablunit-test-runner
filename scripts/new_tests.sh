#!/bin/bash
set -eou pipefail

npm install
npm run webpack
npm run vscode-test
