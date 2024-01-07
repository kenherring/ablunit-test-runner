#!/bin/bash
set -eou pipefail

initialize () {
	echo "$0: Initializing..."
	export PATH=$PATH:$DLC/ant/bin
	WSL=false

	if [ -n "${WSL_DISTRO_NAME:-}" ]; then
		WSL=true
	fi
	OE_VERSION=${OE_VERSION:-12.2.12}
}

# load lots of code for a performance test
get_performance_test_code () {
	echo "$0: Getting performance test code..."
	if [ ! -f ".vscode-test/v${OE_VERSION}.0.tar.gz" ]; then
		mkdir -p .vscode-test
		curl -L "https://github.com/progress/ADE/archive/refs/tags/v${OE_VERSION}.0.tar.gz" -o ".vscode-test/v${OE_VERSION}.0.tar.gz"
		tar -xf ".vscode-test/v${OE_VERSION}.0.tar.gz" -C test_projects/proj7_load_performance/src
	fi
}

get_pct () {
	echo "$0: Getting PCT..."
	if $WSL && [ ! -f ~/.ant/lib/PCT.jar ]; then
		mkdir -p ~/.ant/lib
		curl -v -L https://github.com/Riverside-Software/pct/releases/download/v226/PCT.jar -o ~/.ant/lib/PCT.jar
	fi
}

create_dbs () {
	echo "$0: Creating databases..."
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
