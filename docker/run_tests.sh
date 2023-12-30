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

	while getopts "bdisoh" OPT; do
		case $OPT in
			o) 	OE_VERSION=$OPTARG ;;
			b)	OPTS='-b' ;;
			d)	SCRIPT=development_test ;;
			i)	SCRIPT=install_and_run
				VSCODE_DIR=/home/circleci/project/dummy-ext/.vscode-test ;;
			s)	STAGED_ONLY=true ;;
			h) 	usage && exit 0 ;;
			?) 	usage && exit 1 ;;
			*)	echo "Invalid option: -$OPT" >&2 && usage && exit 1 ;;
		esac
	done

	GIT_BRANCH=$(git branch --show-current)
	PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
	PWD=$(pwd -W 2>/dev/null || pwd)
	export GIT_BRANCH PROGRESS_CFG_BASE64 STAGED_ONLY

	## create volume for .vscode-test directory to persist vscode application downloads
	# docker volume create --name vscode-test
	# docker volume create --name node-modules

	if [ "$OE_VERSION" != "12.2.12" ] && [ "$OE_VERSION" != "12.7.0" ]; then
		echo "Invalid OE version: $OE_VERSION" >&2
		usage && exit 1
	fi
}

run_tests_in_docker () {
	## run tests inside the container
	echo "starting 'docker run' [script=docker/$SCRIPT.sh]..."
	time docker run --rm -it \
		-e PROGRESS_CFG_BASE64 \
		-e GIT_BRANCH \
		-e STAGED_ONLY \
		-v "$PWD":/home/circleci/ablunit-test-provider \
		-v vscode-test:$VSCODE_DIR \
		-v node-modules:/home/circleci/project/node_modules \
		kherring/ablunit-test-runner:"$OE_VERSION" \
		bash -c "/home/circleci/ablunit-test-provider/docker/$SCRIPT.sh $OPTS;"
}

########## MAIN BLOCK ##########
initialize "$@"
run_tests_in_docker
echo "'docker run' completed successfully! [script=docker/$SCRIPT.sh]"
