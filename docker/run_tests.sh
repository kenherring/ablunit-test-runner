#!/bin/bash
set -euo pipefail

usage () {
	echo "
usage: $0 [ -o 12.2.12 | 12.7.0 ] [ -p <project_name> ] [-b] [-i] [-m] [-h]
options:
  -o <version>  OE version (default: 12.2.12)
  -b            drop to bash shell inside container on failure
  -C            delete cache volume before running tests
  -i            run install and run test
  -m            copy modified files and staged files
  -p <project>  run tests for a specific test project
                alternative: set the  ABLUNIT_TEST_RUNNER_PROJECT_NAME environment variable
  -h            show this help message and exit
" >&2
}

initialize () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	OPTS=
	SCRIPT=entrypoint
	DELETE_CACHE_VOLUME=false
	TEST_PROJECT=base
	STAGED_ONLY=true
	OE_VERSION=12.2.12
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}

	while getopts "bCdimso:p:h" OPT; do
		case $OPT in
			o)	OE_VERSION=$OPTARG ;;
			b)	OPTS='-b' ;;
			C)	DELETE_CACHE_VOLUME=true ;;
			i)	TEST_PROJECT=dummy-ext ;;
			m)	STAGED_ONLY=true ;;
			h)	usage && exit 0 ;;
			p)	ABLUNIT_TEST_RUNNER_PROJECT_NAME=$OPTARG ;;
			?)	usage && exit 1 ;;
			*)	echo "Invalid option: -$OPT" >&2 && usage && exit 1 ;;
		esac
	done

	GIT_BRANCH=$(git branch --show-current)
	PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
	PWD=$(pwd -W 2>/dev/null || pwd)
	export GIT_BRANCH PROGRESS_CFG_BASE64 STAGED_ONLY OE_VERSION TEST_PROJECT ABLUNIT_TEST_RUNNER_PROJECT_NAME

	if $DELETE_CACHE_VOLUME; then
		echo "deleting test-runner-cache volume"
		docker volume rm test-runner-cache
	fi

	## create volume for .vscode-test directory to persist vscode application downloads
	if ! docker volume ls | grep -q test-runner-cache; then
		echo "creating test-runner-cache volume"
		docker volume create --name test-runner-cache
	fi

	if [ "$OE_VERSION" != "12.2.12" ] && [ "$OE_VERSION" != "12.7.0" ]; then
		echo "Invalid OE version: $OE_VERSION" >&2
		usage && exit 1
	fi
}

run_tests_in_docker () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"

	local ARGS=(
		--rm
		-it
		-e PROGRESS_CFG_BASE64
		-e GIT_BRANCH
		-e STAGED_ONLY
		-e OE_VERSION
		-e TEST_PROJECT
	)
	[ -n "$ABLUNIT_TEST_RUNNER_PROJECT_NAME" ] && ARGS+=(-e ABLUNIT_TEST_RUNNER_PROJECT_NAME)
	ARGS+=(
		-v "$PWD":/home/circleci/ablunit-test-runner:ro
		-v test-runner-cache:/home/circleci/cache
		kherring/ablunit-test-runner:"$OE_VERSION"
		bash -c "/home/circleci/ablunit-test-runner/docker/$SCRIPT.sh $OPTS;"
	)

	## run tests inside the container
	time docker run "${ARGS[@]}"
}

########## MAIN BLOCK ##########
initialize "$@"
run_tests_in_docker
echo "$0 completed successfully! [script=docker/$SCRIPT.sh]"
