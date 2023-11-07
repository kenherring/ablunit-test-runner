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
if ${CIRCLECI:-false}; then
	xvfb-run -a npm run test
else
	if ! xvfb-run -a npm run test; then
		bash
	fi
fi

RESULTS_COUNT=$(find . -name 'mocha_results_*.xml' | wc -l)
LCOV_COUNT=$(find . -name 'lcov.info' | wc -l)

if [ "$RESULTS_COUNT" = 0 ]; then
	echo 'mocha_results_*.xml not found'
	exit 1
fi
if [ "$LCOV_COUNT" = 0 ]; then
	echo 'lcov.info not found'
	exit 1
fi

echo 'done running tests'
