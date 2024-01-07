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
  -p            run esbuild-bundle instead of build
  -s            run staged tests only
  -h            show this help message and exit
" >&2
}

initialize () {
	OPTS=
	SCRIPT=entrypoint
	STAGED_ONLY=false
	VSCODE_DIR=/home/circleci/project/.vscode-test
	OE_VERSION=12.2.12
	RUNCMD='build'

	while getopts "bdipso:h" OPT; do
		case $OPT in
			o) 	OE_VERSION=$OPTARG ;;
			b)	OPTS='-b' ;;
			d)	SCRIPT=development_test ;;
			i)	SCRIPT=install_and_run
				VSCODE_DIR=/home/circleci/project/dummy-ext/.vscode-test ;;
			p)	RUNCMD='esbuild-bundle' ;;
			s)	STAGED_ONLY=true ;;
			h) 	usage && exit 0 ;;
			?) 	usage && exit 1 ;;
			*)	echo "Invalid option: -$OPT" >&2 && usage && exit 1 ;;
		esac
	done

	GIT_BRANCH=$(git branch --show-current)
	PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
	PWD=$(pwd -W 2>/dev/null || pwd)
	export GIT_BRANCH PROGRESS_CFG_BASE64 STAGED_ONLY OE_VERSION RUNCMD

	## create volume for .vscode-test directory to persist vscode application downloads
	if ! docker volume ls | grep -q vscode-test; then
		docker volume create --name vscode-test
	fi
	if ! docker volume ls | grep -q node-modules; then
		docker volume create --name node-modules
	fi

	if [ "$OE_VERSION" != "12.2.12" ] && [ "$OE_VERSION" != "12.7.0" ]; then
		echo "Invalid OE version: $OE_VERSION" >&2
		usage && exit 1
	fi
}

run_tests_in_docker () {
	## run tests inside the container
	echo "starting 'docker run' [script=docker/$SCRIPT.sh]..."
	echo "RUNCMD=$RUNCMD"
	time docker run --rm -it \
		-e PROGRESS_CFG_BASE64 \
		-e GIT_BRANCH \
		-e STAGED_ONLY \
		-e OE_VERSION \
		-e RUNCMD \
		-v "$PWD":/home/circleci/ablunit-test-provider:ro \
		-v vscode-test:$VSCODE_DIR \
		-v node-modules:/home/circleci/project/node_modules \
		kherring/ablunit-test-runner:"$OE_VERSION" \
		bash -c "/home/circleci/ablunit-test-provider/docker/$SCRIPT.sh $OPTS;"
}

########## MAIN BLOCK ##########
initialize "$@"
run_tests_in_docker
echo "$0 completed successfully! [script=docker/$SCRIPT.sh]"
