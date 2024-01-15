#!/bin/bash
set -eou pipefail

initialize () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	export PATH=$PATH:$DLC/ant/bin
	WSL=false

	while getopts 'S' OPT; do
		case "$OPT" in
			?)	echo "script usage: $(basename "$0") [-S]" >&2
				exit 1 ;;
		esac
	done

	if [ -n "${WSL_DISTRO_NAME:-}" ]; then
		WSL=true
	fi
	OE_VERSION=${OE_VERSION:-12.2.12}
}

# load lots of code for a performance test
get_performance_test_code () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd) OE_VERSION=$OE_VERSION"

	local TO_FILE="/home/circleci/v${OE_VERSION}.0.tar.gz"
	if [ "${OS:-}" = "Windows_NT" ] || [ -n "${WSL_DISTRO_NAME:-}" ]; then
		mkdir -p .vscode-test
		TO_FILE=.vscode-test/v${OE_VERSION}.0.tar.gz
	fi
	if [ ! -f "$TO_FILE" ]; then
		if [ -n "${DOCKER_IMAGE:-}" ]; then
			echo "ERROR: cannot find file '$TO_FILE'"
			echo " - HINT: this should have been fetched during docker build"
		else
			curl -L "https://github.com/progress/ADE/archive/refs/tags/v${OE_VERSION}.0.tar.gz" -o "$TO_FILE"
		fi
	fi
	tar -xf "$TO_FILE" -C test_projects/proj7_load_performance/src
}

get_pct () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	if $WSL && [ ! -f ~/.ant/lib/PCT.jar ]; then
		mkdir -p ~/.ant/lib
		curl -v -L https://github.com/Riverside-Software/pct/releases/download/v226/PCT.jar -o ~/.ant/lib/PCT.jar
	fi
}

create_dbs () {
	echo "[$0 ${FUNCNAME[0]} pwd=$(pwd)"
	if [ ! -d test_projects/proj0/target/db ]; then
		cd test_projects/proj0
		if command -v ant; then
			ant
		else
			"$DLC"/ant/bin/ant
		fi
		cd -
	fi
}

########## MAIN BLOCK ##########
initialize "$@"
scripts/cleanup.sh
get_performance_test_code
get_pct
create_dbs
echo "$0: completed successfully!"
