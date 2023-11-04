#!/bin/bash
set -eou pipefail
set -x

if ! ${CIRCLECI:-false}; then
	echo 'copying files'
	cd /home/circleci/ablunit-test-provider
	rsync -ar --exclude={'.git','.vscode-test','.vscode-test-docker','artifacts','coverage','node_modules','out'} . /home/circleci/project
	tr ' ' '\n' <<< "$PROGRESS_CFG_BASE64" | base64 --decode > /psc/dlc/progress.cfg
	cd /home/circleci/project
fi

echo 'compile, etc...'
npm install
npm run compile

export PROPATH=.

echo 'starting tests...'
xvfb-run -a npm run test
if [ ! -f artifacts/mocha_results.xml ]; then
	echo 'mocha_results.xml not found'
	exit 1
fi

echo 'done running tests'
