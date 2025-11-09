#!/bin/bash
set -eou pipefail

. scripts/common.sh

initialize () {
	log_it "pwd=$(pwd) whoami=$(whoami) HOME=${HOME}"


	if [ -z "$DLC" ]; then
		log_error "DLC environment variable is not set"
		exit 1
	fi
	log_it "DLC=$DLC"

	if ! command -v ant; then
		PATH=$PATH:$DLC/ant/bin
	fi
	CIRCLECI=${CIRCLECI:-false}
	if $CIRCLECI; then
		HOME=/github/home
	fi
	NO_BUILD=${NO_BUILD:-false}
	VERBOSE=${VERBOSE:-false}
	WSL=false
	VERBOSE=${VERBOSE:-false}
	ABLUNIT_TEST_RUNNER_OE_VERSION=${ABLUNIT_TEST_RUNNER_OE_VERSION:-}
	ABLUNIT_TEST_RUNNER_VSCODE_VERSION=${ABLUNIT_TEST_RUNNER_VSCODE_VERSION:-}
	[ -z "${WSL_DISTRO_NAME:-}" ] && WSL=true
	PACKAGE_VERSION=$(node -p "require('./package.json').version")

	while getopts 'hNoVv' OPT; do
		case "$OPT" in
			N)	NO_BUILD=true ;;
			o)	ABLUNIT_TEST_RUNNER_OE_VERSION="$OPTARG" ;;
			V)	ABLUNIT_TEST_RUNNER_VSCODE_VERSION="$OPTARG" ;;
			v)	VERBOSE=true ;;
			?)	log_it "script usage: $(basename "$0") [-h] [-N]" >&2
				exit 1 ;;
		esac
	done

	if [ -z "$ABLUNIT_TEST_RUNNER_OE_VERSION" ]; then
		cat "$DLC/version"
		ABLUNIT_TEST_RUNNER_OE_VERSION=$(awk '{print $3}' < "$DLC/version")
		if [[ "$ABLUNIT_TEST_RUNNER_OE_VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
			ABLUNIT_TEST_RUNNER_OE_VERSION="${ABLUNIT_TEST_RUNNER_OE_VERSION}.0"
		fi
	fi
	if [[ ! "$ABLUNIT_TEST_RUNNER_OE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		log_error "invalid ABLUNIT_TEST_RUNNER_OE_VERSION: '$ABLUNIT_TEST_RUNNER_OE_VERSION'"
		exit 1
	fi

	export PATH CIRCLECI ABLUNIT_TEST_RUNNER_OE_VERSION ABLUNIT_TEST_RUNNER_VSCODE_VERSION

	if [ -d artifacts ]; then
		rm -rf artifacts/*
	fi

	if [ ! -d node_modules ]; then
		log_it 'start npm ci'
		npm ci
		log_it 'end npm ci'
	fi
}

# load lots of code for a performance test
get_performance_test_code () {
	log_it "pwd=$(pwd) ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION ABLUNIT_TEST_RUNNER_VSCODE_VERSION=${ABLUNIT_TEST_RUNNER_VSCODE_VERSION:-}"

	local TO_FILE="$HOME/v${ABLUNIT_TEST_RUNNER_OE_VERSION}.0.tar.gz"
	if [ "${OS:-}" = "Windows_NT" ] || [ -n "${WSL_DISTRO_NAME:-}" ]; then
		mkdir -p .vscode-test
		TO_FILE=.vscode-test/v${ABLUNIT_TEST_RUNNER_OE_VERSION}.0.tar.gz
	fi
	if [ ! -f "$TO_FILE" ]; then
		curl -L "https://github.com/progress/ADE/archive/refs/tags/v${ABLUNIT_TEST_RUNNER_OE_VERSION}.0.tar.gz" -o "$TO_FILE"
		# if [ -n "${DOCKER_IMAGE:-}" ]; then
		# 	log_error "cannot find file '$TO_FILE'\n" \
		# 		" - HINT: this should have been fetched during docker build"
		# else
		# 	curl -L "https://github.com/progress/ADE/archive/refs/tags/v${ABLUNIT_TEST_RUNNER_OE_VERSION}.0.tar.gz" -o "$TO_FILE"
		# fi
	fi
	tar -xf "$TO_FILE" -C test_projects/proj7_load_performance/src
}

copy_user_settings () {
	log_it

	if [ -d .vscode-test ]; then
		$VERBOSE && find .vscode-test -type f -name "*.log"
		find .vscode-test -type f -name "*.log" -delete
		if [ -d .vscode-test/user-data ]; then
			$VERBOSE && find .vscode-test/user-data
			find .vscode-test/user-data -delete
		fi
	fi

	mkdir -p .vscode-test/user-data/User
	cp test/resources/.vscode-test/user-data/User/argv.json .vscode-test/user-data/User/argv.json
	sed "s,\$DLC,${DLC//\\//},g;s,\$NAME,${ABLUNIT_TEST_RUNNER_OE_VERSION%.*}," test/resources/.vscode-test/user-data/User/settings.json > .vscode-test/user-data/User/settings.json
}

get_pct () {
	log_it "pwd=$(pwd)"
	if [ ! -d ~/.ant/lib ]; then
		log_it "mkdir"
		mkdir -p ~/.ant/lib
	fi

	if $WSL && [ ! -f ~/.ant/lib/PCT.jar ]; then
		mkdir -p ~/.ant/lib
		local ARGS=()
		ARGS+=(-L -o ~/.ant/lib/PCT.jar)
		if $VERBOSE; then
			ARGS+=(-v)
		else
			ARGS+=(-s)
		fi
		if [ -z "${PCT_VERSION:-}" ]; then
			. docker/.env
		fi
		curl "${ARGS[@]}" "https://github.com/Riverside-Software/pct/releases/download/v${PCT_VERSION}/PCT.jar"
	fi
}

create_dbs () {
	log_it "pwd=$(pwd)"
	if [ -d test_projects/proj0/target/db ]; then
		return 0
	fi

	local COMMAND=ant
	cd test_projects/proj0
	COMMAND=ant
	if ! command -v $COMMAND; then
		COMMAND="$DLC/ant/bin/ant"
	fi
	mkdir -p artifacts
	$COMMAND > artifacts/pretest_ant.log >&1
	cd -
}

package () {
	if $NO_BUILD; then
		log_it "skipping package (NO_BUILD=$NO_BUILD)"
		return 0
	fi
	log_it "pwd=$(pwd)"

	local PACKAGE_OUT_OF_DATE=false
	local VSIX_COUNT=0
	VSIX_COUNT=$(find . -maxdepth 1 -name "*.vsix" 2>/dev/null | wc -l)
	log_it "VSIX_COUNT=$VSIX_COUNT"

	if [ -f "ablunit-test-runner-$PACKAGE_VERSION.vsix" ]; then
		NEWEST_SOURCE=$(find src -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
		NEWEST_SOURCE_TEST=$(find test -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
		NEWEST_SOURCE_ROOT=$(find . -maxdepth 1 -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

		if $VERBOSE; then
			log_it "recent source files:"
			ls -altr "$NEWEST_SOURCE" "$NEWEST_SOURCE_TEST" "$NEWEST_SOURCE_ROOT" "ablunit-test-runner-$PACKAGE_VERSION.vsix"
		fi

		[ "$NEWEST_SOURCE_TEST" -nt "$NEWEST_SOURCE" ] && NEWEST_SOURCE=$NEWEST_SOURCE_TEST
		[ "$NEWEST_SOURCE_ROOT" -nt "$NEWEST_SOURCE" ] && NEWEST_SOURCE=$NEWEST_SOURCE_ROOT

		if  [ "$NEWEST_SOURCE" -nt "ablunit-test-runner-$PACKAGE_VERSION.vsix" ]; then
			log_it "newer source file found: $NEWEST_SOURCE"
			PACKAGE_OUT_OF_DATE=true
		fi
	else
		PACKAGE_OUT_OF_DATE=true
	fi
	log_it "CIRCLECI=$CIRCLECI PACKAGE_OUT_OF_DATE=$PACKAGE_OUT_OF_DATE VSIX_COUNT=$VSIX_COUNT"
	if $PACKAGE_OUT_OF_DATE || $CIRCLECI || [ "$VSIX_COUNT" = "0" ]; then
		./scripts/package.sh
	fi

	VSIX_COUNT=$(find . -maxdepth 1 -name "*.vsix" 2>/dev/null | wc -l)
	if [ "$VSIX_COUNT" = "0" ]; then
		log_error "no .vsix files found"
		exit 1
	fi
}

########## MAIN BLOCK ##########
START_TIME=$(date +%s)
initialize "$@"
copy_user_settings
get_performance_test_code
get_pct
create_dbs
package
rm -rf artifacts/*
END_TIME=$(date +%s)
log_it "completed successfully! (time=$((END_TIME - START_TIME))s)"
