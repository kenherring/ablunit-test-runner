#!/bin/bash
set -eou pipefail

initialize () {
	BASH_AFTER_FAIL=false
	while getopts 'b' OPT; do
		case "$OPT" in
			b)	BASH_AFTER_FAIL=true ;;
			?)	echo "script usage: $(basename "$0") [-b]" >&2
				exit 1 ;;
		esac
	done

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
}

setup () {
	echo 'compile, etc...'
	npm install
	npm run compile
	test_projects/setup.sh

	echo 'starting tests...'
	sed -i 's/"activationEvents"/"activationEvents-vscode"/g;s/"activationEvents-coverage"/"activationEvents"/g' package.json

	# export ELECTRON_ENABLE_LOGGING=true
	service dbus start
}

run_tests () {
	if $BASH_AFTER_FAIL; then
		if ! xvfb-run -a npm test; then
			bash
		fi
	else
		xvfb-run -a npm run test
	fi
}

teardown () {
	sed -i 's/"activationEvents"/"activationEvents-coverage"/g;s/"activationEvents-vscode"/"activationEvents"/g' package.json
}

analyze_results () {
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
		if $BASH_AFTER_FAIL; then
			bash
		fi
		exit 1
	fi
}

########## MAIN BLOCK ##########
initialize "$@"
setup
run_tests
teardown
analyze_results
echo 'done running tests'
