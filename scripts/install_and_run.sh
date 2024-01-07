#!/bin/bash
set -eou pipefail

rm -f ./*.vsix

npm install
vsce package --pre-release --githubBranch "$(git branch --show-current)"
cd dummy-ext
npm run compile
npm run test:install-and-run
echo "install_and_run.sh completed successfully!"
