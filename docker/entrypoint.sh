#!/bin/bash
set -eou pipefail
set -x

tr ' ' '\n' <<< "$PROGRESS_CFG_BASE64" | base64 --decode > /psc/dlc/progress.cfg

if ! ${CIRCLECI:-false}; then
	echo 'copying files'
	cd /home/circleci/project
	git config --global init.defaultBranch main
	git init
	git remote add origin /home/circleci/ablunit-test-provider
	git fetch origin
	if [ "$GIT_BRANCH" = "$(git branch show-current)" ]; then
		git reset --hard "origin/$GIT_BRANCH"
	else
		git checkout "$GIT_BRANCH"
	fi

	while read -r FILE; do
		echo "copying staged file $FILE"
		cp "/home/circleci/ablunit-test-provider/$FILE" "$FILE"
	done < <(cd /home/circleci/ablunit-test-provider && git diff --name-only --staged)

	while read -r FILE; do
		echo "copying modified file $FILE"
		cp "/home/circleci/ablunit-test-provider/$FILE" "$FILE"
	done < <(cd /home/circleci/ablunit-test-provider && git diff --name-only)
fi

echo 'compile, etc...'
npm install
npm run compile
test_projects/setup.sh

echo 'starting tests...'
sed -i 's/"activationEvents"/"activationEvents-vscode"/g;s/"activationEvents-coverage"/"activationEvents"/g' package.json
xvfb-run -a npm run test
# if ! xvfb-run -a npm test && ! ${CIRCLECI:-false}; then
# 	bash
# fi
sed -i 's/"activationEvents"/"activationEvents-coverage"/g;s/"activationEvents-vscode"/"activationEvents"/g' package.json

RESULTS_COUNT=$(find . -name 'mocha_results_*.xml' | wc -l)
LCOV_COUNT=$(find . -name 'lcov.info' | wc -l)

HAS_ERROR=false
if [ "$RESULTS_COUNT" = 0 ]; then
	echo 'ERROR: mocha_results_*.xml not found'
	HAS_ERROR=true
fi
if [ "$LCOV_COUNT" = 0 ]; then
	echo 'ERROR: lcov.info not found'
	HAS_ERROR=true
fi
if $HAS_ERROR; then
	exit 1
fi

echo 'done running tests'
