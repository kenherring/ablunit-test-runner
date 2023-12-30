#!/bin/bash
set -eou pipefail

vsce package --pre-release --githubBranch "$(git branch --show-current)"
cd dummy-ext
npm run compile
npm run test:install-and-run
echo "install_and_run.sh completed successfully!"
