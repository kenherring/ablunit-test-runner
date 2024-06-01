#!/bin/bash
set -euo pipefail

initialize () {
	local OPT OPTARG OPTIND
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	VERBOSE=${VERBOSE:-false}
	ABLUNIT_TEST_RUNNER_DBUS_NUM=${ABLUNIT_TEST_RUNNER_DBUS_NUM:-3}
	ABLUNIT_TEST_RUNNER_OE_VERSION=${ABLUNIT_TEST_RUNNER_OE_VERSION:-12.2.12}
	ABLUNIT_TEST_RUNNER_VSCODE_VERSION=${ABLUNIT_TEST_RUNNER_VSCODE_VERSION:-stable}
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}
	ABLUNIT_TEST_RUNNER_NO_COVERAGE=${ABLUNIT_TEST_RUNNER_NO_COVERAGE:-false}
	if $VERBOSE; then
		echo "ABLUNIT_TEST_RUNNER_DBUS_NUM=$ABLUNIT_TEST_RUNNER_DBUS_NUM"
		echo "ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"
		echo "ABLUNIT_TEST_RUNNER_VSCODE_VERSION=$ABLUNIT_TEST_RUNNER_VSCODE_VERSION"
		echo "ABLUNIT_TEST_RUNNER_PROJECT_NAME=$ABLUNIT_TEST_RUNNER_PROJECT_NAME"
		echo "ABLUNIT_TEST_RUNNER_NO_COVERAGE=$ABLUNIT_TEST_RUNNER_NO_COVERAGE"
	fi
	BASH_AFTER=false
	BASH_AFTER_ERROR=false
	CACHE_BASE=/home/circleci/cache
	CIRCLECI=${CIRCLECI:-false}
	npm_config_cache=$CACHE_BASE/node_modules_cache
	PROJECT_DIR=/home/circleci/project
	REPO_VOLUME=/home/circleci/ablunit-test-runner
	GIT_BRANCH=$(cd "$REPO_VOLUME" && git branch --show-current)
	STAGED_ONLY=${STAGED_ONLY:-true}
	${CREATE_PACKAGE:-false} && TEST_PROJECT=package

	git config --global init.defaultBranch main
	mkdir -p "$npm_config_cache" "$PROJECT_DIR"
	export npm_config_cache

	while getopts 'bB' OPT; do
		case "$OPT" in
			b)	BASH_AFTER=true
				BASH_AFTER_ERROR=true ;;
			B)	BASH_AFTER_ERROR=true ;;
			?)	echo "script usage: $(basename "$0") [-b]" >&2
				exit 1 ;;
		esac
	done

	if [ -z "${TEST_PROJECT:-}" ]; then
		echo "ERROR: \$TEST_PROJECT not set (values: base, dummy-ext)"
		exit 1
	fi

	## save license from the environment variable at runtime
	tr ' ' '\n' <<< "$PROGRESS_CFG_BASE64" | base64 --decode > /psc/dlc/progress.cfg

	echo 'copying files from local'
	initialize_repo
	restore_cache

	if [ -z "${CIRCLE_BRANCH:-}" ]; then
		CIRCLE_BRANCH=$(git branch --show-current)
	fi
}

initialize_repo () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	if [ ! -d "$PROJECT_DIR/.git" ]; then
		git clone "$REPO_VOLUME" "$PROJECT_DIR"
	else
		git pull
	fi
	cd "$PROJECT_DIR"
	if [ "$(git branch --show-current)" = "$GIT_BRANCH" ]; then
		git pull
	else
		git fetch origin "$GIT_BRANCH":"$GIT_BRANCH"
		git checkout "$GIT_BRANCH"
	fi
	copy_files_from_volume
}

copy_files_from_volume () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	find_files_to_copy
	copy_files "staged"
	[ -f /tmp/modified_files ] && copy_files "modified"
	while read -r FILE; do
		echo "deleting deleted file $FILE"
		rm "$FILE"
	done < /tmp/deleted_files
}

find_files_to_copy () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	local BASE_DIR
	BASE_DIR=$(pwd)

	cd "$REPO_VOLUME"
	git config --global --add safe.directory "$REPO_VOLUME"
	git --no-pager diff --diff-filter=d --name-only --staged --ignore-cr-at-eol > /tmp/staged_files
	git --no-pager diff --diff-filter=D --name-only --staged --ignore-cr-at-eol > /tmp/deleted_files
	if ! $STAGED_ONLY; then
		git --no-pager diff --diff-filter=d --name-only --ignore-cr-at-eol > /tmp/modified_files
	fi

	echo "file counts:"
	echo "   staged=$(wc -l /tmp/staged_files)"
	echo "  deleted=$(wc -l /tmp/deleted_files)"
	echo " modified=$(wc -l /tmp/modified_files 2>/dev/null || echo 0)"

	cd "$BASE_DIR"
}

copy_files () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	local TYPE="$1"
	while read -r FILE; do
		echo "copying $TYPE file $FILE"
		if [ ! -d "$(dirname "$FILE")" ]; then
			mkdir -p "$(dirname "$FILE")"
		fi
		sed 's/\r//g' "$REPO_VOLUME/$FILE" > "$FILE"
	done < "/tmp/${TYPE}_files"
}

run_tests () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"

	npm run clean

	if [ "$TEST_PROJECT" = "package" ]; then
		.circleci/package.sh
	elif [ "$TEST_PROJECT" = "base" ]; then
		run_tests_base || E_CODE=$?
		save_cache
		[ "${E_CODE:-0}" = 0 ] || exit "$E_CODE"
	elif [ "$TEST_PROJECT" = "dummy-ext" ]; then
		run_tests_dummy_ext
	else
		echo "ERROR: unknown test project"
		exit 1
	fi
}

run_tests_base () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"

	set -eo pipefail ## matches the behavior of CircleCI
	if ! .circleci/run_test_wrapper.sh; then
		echo "run_tests failed"
		$BASH_AFTER_ERROR && bash
		exit 1
	fi
	set -euo pipefail
	echo "run_tests success"

	if [ -z "${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}" ]; then
		analyze_results
		scripts/validate.sh
	fi
}

analyze_results () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	RESULTS_COUNT=$(find . -name 'mocha_results_*.xml' | wc -l)
	LCOV_COUNT=$(find . -name 'lcov.info' | wc -l)
	HAS_ERROR=false

	if [ "$RESULTS_COUNT" = 0 ]; then
		echo 'ERROR: mocha_results_*.xml not found'
		HAS_ERROR=true
	fi
	if [ "$TEST_PROJECT" = "base" ] && [ "$LCOV_COUNT" = 0 ]; then
		echo 'ERROR: lcov.info not found'
		HAS_ERROR=true
	fi

	if $HAS_ERROR; then
		$BASH_AFTER_ERROR && bash
		exit 1
	fi

	if $VERBOSE; then
		echo "artifacts to be saved:"
		ls -al artifacts || true
	fi
}

run_tests_dummy_ext () {
	echo "[$0 ${FUNCNAME[0]}] pwd = $(pwd)"

	if ! .circleci/install_and_run.sh; then
		echo "run_tests failed"
		$BASH_AFTER_ERROR && bash
		exit 1
	fi
	echo "run_tests success"
	analyze_results
}

save_cache () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"

	# npm run clean

	if [ -d .vscode-test ]; then
		echo "saving .vscode-test to cache"
		mkdir -p "$CACHE_BASE/.vscode-test"
		mkdir -p "$CACHE_BASE/node_modules"
		rsync -aR ./.vscode-test "$CACHE_BASE"
		rsync -aR ./node_modules "$CACHE_BASE"
	fi

	if [ -d ./dummy-ext/.vscode-test ]; then
		echo "saving dummy-ext/.vscode-test to cache"
		mkdir -p "$CACHE_BASE/dummy-ext/.vscode-test"
		mkdir -p "$CACHE_BASE/dummy-ext/node_modules"
		if [ -d ./dummy-ext/.vscode-test ]; then
			rsync -aR ./dummy-ext/.vscode-test "$CACHE_BASE"
		fi
		if [ -d ./dummy-ext/node_modules ]; then
			rsync -aR ./dummy-ext/node_modules "$CACHE_BASE"
		fi
	elif [ "$TEST_PROJECT" = "dummy-ext" ]; then
		echo "WARNING: dummy-ext/.vscode-test not found.  cannot save cache"
		exit 1
	fi
}

restore_cache () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	local BASE_DIR
	BASE_DIR=$(pwd)

	cd "$CACHE_BASE"
	if [ -d "$CACHE_BASE/.vscode-test" ]; then
		echo "restoring .vscode-test from cache"
		rsync -aR ./.vscode-test "$BASE_DIR"
	fi
	if [ -d "$CACHE_BASE/dummy-ext/.vscode-test" ]; then
		echo "restoring dummy-ext/.vscode-test from cache"
		rsync -aR ./dummy-ext/.vscode-test "$BASE_DIR"
	elif [ "$TEST_PROJECT" = "dummy-ext" ]; then
		echo "WARNING: dummy-ext/.vscode-test not found in cache"
	fi
	cd -
}

finish () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	save_cache
	$BASH_AFTER && bash
	echo "[$0] completed successfully!"
}

########## MAIN BLOCK ##########
initialize "$@"
run_tests
finish
