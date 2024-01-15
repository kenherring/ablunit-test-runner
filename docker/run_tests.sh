#!/bin/bash
set -eou pipefail

usage () {
	echo "
usage: $0 [ -o 12.2.12 | 12.7.0 ] [-b] [-d] [-i] [-s] [-h]
options:
  -o <version>  OE version (default: 12.2.12)
  -b            drop to bash shell inside container on failure
  -d            run development test
  -i            run install and run test
  -p            run webpack instead of build
  -s            run staged tests only
  -h            show this help message and exit
" >&2
}

initialize () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	OPTS=
	SCRIPT=entrypoint
	TEST_PROJECT=base
	STAGED_ONLY=false
	OE_VERSION=12.2.12
	RUNCMD='build'

	while getopts "bdipso:h" OPT; do
		case $OPT in
			o) 	OE_VERSION=$OPTARG ;;
			b)	OPTS='-b' ;;
			d)	SCRIPT=development_test ;;
			i)	TEST_PROJECT=dummy-ext ;;
			p)	RUNCMD='webpack' ;;
			s)	STAGED_ONLY=true ;;
			h) 	usage && exit 0 ;;
			?) 	usage && exit 1 ;;
			*)	echo "Invalid option: -$OPT" >&2 && usage && exit 1 ;;
		esac
	done

	GIT_BRANCH=$(git branch --show-current)
	PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
	PWD=$(pwd -W 2>/dev/null || pwd)
	export GIT_BRANCH PROGRESS_CFG_BASE64 STAGED_ONLY OE_VERSION RUNCMD TEST_PROJECT

	## create volume for .vscode-test directory to persist vscode application downloads
	if ! docker volume ls | grep -q test-runner-cache; then
		docker volume create --name test-runner-cache
	fi

	if [ "$OE_VERSION" != "12.2.12" ] && [ "$OE_VERSION" != "12.7.0" ]; then
		echo "Invalid OE version: $OE_VERSION" >&2
		usage && exit 1
	fi
}

run_tests_in_docker () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	## run tests inside the container
	echo "RUNCMD=$RUNCMD"
	time docker run --rm -it \
		-e PROGRESS_CFG_BASE64 \
		-e GIT_BRANCH \
		-e STAGED_ONLY \
		-e OE_VERSION \
		-e RUNCMD \
		-e TEST_PROJECT \
		-v "$PWD":/home/circleci/ablunit-test-runner:ro \
		-v test-runner-cache:/home/circleci/cache \
		kherring/ablunit-test-runner:"$OE_VERSION" \
		bash -c "/home/circleci/ablunit-test-runner/docker/$SCRIPT.sh $OPTS;"
}

########## MAIN BLOCK ##########
initialize "$@"
run_tests_in_docker
echo "$0 completed successfully! [script=docker/$SCRIPT.sh]"
