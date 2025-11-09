#!/bin/bash
set -eou pipefail

log_it () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[1]}]" "$@"
}

initialize () {
	local OPT OPTARG OPTIND
	log_it  "pwd=$(pwd)"
	VERBOSE=${VERBOSE:-false}
	HOME=/github/home
	ABLUNIT_TEST_RUNNER_DBUS_NUM=${ABLUNIT_TEST_RUNNER_DBUS_NUM:-3}
	ABLUNIT_TEST_RUNNER_OE_VERSION=${ABLUNIT_TEST_RUNNER_OE_VERSION:-}
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}
	ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG=true
	if $VERBOSE; then
		log_it "ABLUNIT_TEST_RUNNER_DBUS_NUM=$ABLUNIT_TEST_RUNNER_DBUS_NUM"
		log_it "ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"
		log_it "ABLUNIT_TEST_RUNNER_PROJECT_NAME=$ABLUNIT_TEST_RUNNER_PROJECT_NAME"
		log_it "ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG=$ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG"
	fi
	BASH_AFTER=false
	BASH_AFTER_ERROR=false
	CACHE_BASE="$HOME"/cache
	npm_config_cache=$CACHE_BASE/node_modules_cache
	PROJECT_DIR="$HOME"/project
	REPO_VOLUME="$HOME"/ablunit-test-runner
	[ -z "${CIRCLE_BRANCH:-}" ] && CIRCLE_BRANCH=${GIT_BRANCH:-}
	STAGED_ONLY=${STAGED_ONLY:-true}
	${CREATE_PACKAGE:-false} && TEST_PROJECT=package

	export ABLUNIT_TEST_RUNNER_DBUS_NUM \
		ABLUNIT_TEST_RUNNER_OE_VERSION \
		ABLUNIT_TEST_RUNNER_PROJECT_NAME \
		ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG

	git config --global init.defaultBranch main
	mkdir -p "$npm_config_cache" "$PROJECT_DIR"
	export npm_config_cache

	while getopts 'bBx' OPT; do
		case "$OPT" in
			b)	BASH_AFTER=true
				BASH_AFTER_ERROR=true ;;
			B)	BASH_AFTER_ERROR=true ;;
			x)	set -x ;;
			?)	echo "script usage: $(basename "$0") [-b]" >&2
				exit 1 ;;
		esac
	done

	if [ -z "${TEST_PROJECT:-}" ]; then
		log_error "\$TEST_PROJECT not set (values: base, dummy-ext)"
		exit 1
	fi

	## save license from the environment variable at runtime
	tr ' ' '\n' <<< "$PROGRESS_CFG_BASE64" | base64 --decode > /psc/dlc/progress.cfg

	log_it 'copying files from local'
	initialize_repo
	# restore_cache

	if [ -z "${CIRCLE_BRANCH:-}" ]; then
		CIRCLE_BRANCH=$(git branch --show-current)
	fi
}

initialize_repo () {
	log_it "pwd=$(pwd)"
	if [ -d "$PROJECT_DIR/.git" ]; then
		cd "$PROJECT_DIR"
		git fetch
	elif [ -d "$PROJECT_DIR" ]; then
		cd "$PROJECT_DIR"
		git init
		git remote add origin "$REPO_VOLUME"
		if ! git fetch; then
			git config --global --add safe.directory "$REPO_VOLUME/.git"
			git fetch
		fi
	else
		git clone "$REPO_VOLUME" "$PROJECT_DIR"
	fi

	if [ -n "${CIRCLE_TAG:-}" ]; then
		log_it "checking out tag $CIRCLE_TAG"
		git checkout "$CIRCLE_TAG"
	else
		log_it "checking out branch $CIRCLE_BRANCH"
		git checkout "$CIRCLE_BRANCH"
	fi
	copy_files_from_volume
}

copy_files_from_volume () {
	log_it "pwd=$(pwd)"
	find_files_to_copy
	copy_files "staged"
	[ -f /tmp/modified_files ] && copy_files "modified"
	while read -r FILE; do
		log_it "deleting deleted file $FILE"
		rm "$FILE"
	done < /tmp/deleted_files
}

find_files_to_copy () {
	log_it "pwd=$(pwd)"
	local BASE_DIR
	BASE_DIR=$(pwd)

	cd "$REPO_VOLUME"
	git config --global --add safe.directory "$REPO_VOLUME"
	git --no-pager diff --diff-filter=d --name-only --staged --ignore-cr-at-eol > /tmp/staged_files
	git --no-pager diff --diff-filter=D --name-only --staged --ignore-cr-at-eol > /tmp/deleted_files
	if ! $STAGED_ONLY; then
		git status --porcelain | grep -E '^ (M|A)' | cut -c4- || true
		git status --porcelain | grep -E '^ (M|A)' | cut -c4- > /tmp/modified_files || true
	else
		touch /tmp/modified_files
	fi

	log_it "file counts:"
	log_it "   staged=$(wc -l /tmp/staged_files)"
	log_it "  deleted=$(wc -l /tmp/deleted_files)"
	log_it " modified=$(wc -l /tmp/modified_files)"

	cd "$BASE_DIR"
}

copy_files () {
	log_it "pwd=$(pwd)"
	local TYPE="$1"
	log_it "TYPE=$TYPE"
	while read -r FILE; do
		if [ ! -d "$FILE" ]; then
			log_it "copying $TYPE file $FILE"
			if [ ! -d "$(dirname "$FILE")" ]; then
				mkdir -p "$(dirname "$FILE")"
			fi
			sed 's/\r//g' "$REPO_VOLUME/$FILE" > "$FILE"
		fi
	done < "/tmp/${TYPE}_files"
}

run_tests () {
	log_it "pwd=$(pwd)"

	npm run clean

	if [ "$TEST_PROJECT" = "package" ]; then
		./scripts/package.sh
	elif [ "$TEST_PROJECT" = "base" ]; then
		run_tests_base || E_CODE=$?
		save_cache
		[ "${E_CODE:-0}" = 0 ] || exit "$E_CODE"
	elif [ "$TEST_PROJECT" = "dummy-ext" ]; then
		run_tests_dummy_ext
	else
		log_error "unknown test project"
		exit 1
	fi
}

run_tests_base () {
	log_it "pwd=$(pwd)"

	set -eo pipefail ## matches the behavior of CircleCI
	if ! ./scripts/run_test_wrapper.sh; then
		log_it "run_tests failed"
		$BASH_AFTER_ERROR && bash
		exit 1
	fi
	set -eou pipefail
	log_it "run_tests success"

	if [ -z "${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}" ]; then
		analyze_results
		scripts/validate.sh
	fi
}

analyze_results () {
	log_it "pwd=$(pwd)"
	RESULTS_COUNT=$(find artifacts/mocha_results_sonar/ -name '*.xml' | wc -l)
	HAS_ERROR=false

	if [ "$RESULTS_COUNT" = 0 ]; then
		log_error 'artifacts/mocha_results_sonar/*.xml not found'
		HAS_ERROR=true
	fi

	if $HAS_ERROR; then
		$BASH_AFTER_ERROR && bash
		exit 1
	fi

	if $VERBOSE; then
		log_it "artifacts to be saved:"
		ls -al artifacts || true
	fi
}

run_tests_dummy_ext () {
	log_it "pwd=$(pwd)"

	if ! ./scripts/install_and_run.sh; then
		log_it "run_tests failed"
		$BASH_AFTER_ERROR && bash
		exit 1
	fi
	log_it "run_tests success"
	analyze_results
}

save_cache () {
	log_it "pwd=$(pwd)"

	# npm run clean

	if [ -d .vscode-test ]; then
		log_it "saving .vscode-test to cache"
		mkdir -p "$CACHE_BASE/.vscode-test"
		mkdir -p "$CACHE_BASE/node_modules"
		mkdir -p "$CACHE_BASE/npm"
		rsync -aR ./.vscode-test "$CACHE_BASE"
		rsync -aR ./node_modules "$CACHE_BASE"
		rsync -aR "$npm_config_cache" "$CACHE_BASE/npm"
	fi

	if [ -d ./dummy-ext/.vscode-test ]; then
		log_it "saving dummy-ext/.vscode-test to cache"
		mkdir -p "$CACHE_BASE/dummy-ext/.vscode-test"
		mkdir -p "$CACHE_BASE/dummy-ext/node_modules"
		if [ -d ./dummy-ext/.vscode-test ]; then
			rsync -aR ./dummy-ext/.vscode-test "$CACHE_BASE"
		fi
		if [ -d ./dummy-ext/node_modules ]; then
			rsync -aR ./dummy-ext/node_modules "$CACHE_BASE"
		fi
	elif [ "$TEST_PROJECT" = "dummy-ext" ]; then
		log_it "WARNING: dummy-ext/.vscode-test not found.  cannot save cache"
		exit 1
	fi
}

restore_cache () {
	log_it "pwd=$(pwd)"
	local BASE_DIR
	BASE_DIR=$(pwd)

	cd "$CACHE_BASE"
	if [ -d "$CACHE_BASE/.vscode-test" ]; then
		log_it "restoring .vscode-test from cache"
		rsync -aR ./.vscode-test "$BASE_DIR"
	fi
	if [ -d "$CACHE_BASE/npm" ]; then
		log_it "restoring $npm_config_cache from cache"
		rsync -aR ./npm "$npm_config_cache"
	fi
	if [ -d "$CACHE_BASE/dummy-ext/.vscode-test" ]; then
		log_it "restoring dummy-ext/.vscode-test from cache"
		rsync -aR ./dummy-ext/.vscode-test "$BASE_DIR"
	elif [ "$TEST_PROJECT" = "dummy-ext" ]; then
		log_it "WARNING: dummy-ext/.vscode-test not found in cache"
	fi
	cd -
}

finish () {
	log_it "pwd=$(pwd)"
	save_cache
	$BASH_AFTER && bash
	END_TIME=$(date +%s)
	log_it "completed successfully! (time=$((END_TIME - START_TIME))s)"
}

########## MAIN BLOCK ##########
START_TIME=$(date +%s)
initialize "$@"
run_tests
finish
