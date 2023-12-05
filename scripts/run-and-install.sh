#!/bin/bash
set -eou pipefail

vsce package --pre-release --githubBranch "$(git branch --show-current)"
cd dummy-ext
npm run test:install-and-run
