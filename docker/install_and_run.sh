#!/bin/bash
set -eou pipefail
set -x

initialize () {
	echo "[$0 initialize] pwd=$(pwd)"
	tr ' ' '\n' <<< "$PROGRESS_CFG_BASE64" | base64 --decode > /psc/dlc/progress.cfg

	local OPT OPTARG OPTIND
	BASH_AFTER=false
	REPO_VOLUME=/home/circleci/ablunit-test-provider
	export npm_config_cache=/home/circleci/node_modules/dummy-ext
	npm set cache "$npm_config_cache"
	mkdir -p /home/circleci/project

	while getopts 'b' OPT; do
		case "$OPT" in
			b)	BASH_AFTER=true ;;
			?)	echo "script usage: $(basename "$0") [-b]" >&2
				exit 1 ;;
		esac
	done

	echo 'copying files from local'
	initialize_repo
	copy_files_from_volume
}

initialize_repo () {
	echo "[$0 initialize_repo]"
	cd /home/circleci/project
	git config --global init.defaultBranch main
	git init
	git remote add origin "$REPO_VOLUME"
	git fetch origin
	if [ "$GIT_BRANCH" = "$(git branch --show-current)" ]; then
		git reset --hard "origin/$GIT_BRANCH"
	else
		git checkout "$GIT_BRANCH"
	fi
}

copy_files_from_volume () {
	echo "[$0 copy_files_from_volume]"
	find_files_to_copy
	copy_files "staged"
	[ -f /tmp/modified_files ] && copy_files "modified"
	while read -r FILE; do
		echo "deleting deleted file $FILE"
		rm "$FILE"
	done < /tmp/deleted_files
}

find_files_to_copy () {
	echo "[$0 find_files_to_copy]"
	local BASE_DIR
	BASE_DIR=$(pwd)

	cd "$REPO_VOLUME"
	git config --global --add safe.directory "$REPO_VOLUME"
	git --no-pager diff --diff-filter=d --name-only --staged --ignore-cr-at-eol > /tmp/staged_files
	git --no-pager diff --diff-filter=D --name-only --staged --ignore-cr-at-eol > /tmp/deleted_files
	if ! ${STAGED_ONLY:-false}; then
		git --no-pager diff --diff-filter=d --name-only --ignore-cr-at-eol > /tmp/modified_files
	fi

	echo "file counts:"
	echo "  staged=$(wc -l /tmp/staged_files)"
	echo " deleted=$(wc -l /tmp/deleted_files)"
	echo " modified=$(wc -l /tmp/modified_files)"

	cd "$BASE_DIR"
}

copy_files () {
	echo "[$0 copy_files]"
	local TYPE="$1"
	while read -r FILE; do
		echo "copying $TYPE file $FILE"
		if [ ! -d "$(dirname "$FILE")" ]; then
			mkdir -p "$(dirname "$FILE")"
		fi
		sed 's/\r//g' "$REPO_VOLUME/$FILE" > "$FILE"
	done < "/tmp/${TYPE}_files"
}

package_extension () {
	echo "[$0 package_extension] pwd = $(pwd)"
	npm install
	vsce package --pre-release --githubBranch "$(git branch --show-current)"

	echo "find packages: $(find . -name "ablunit-test-provider-*.vsix")"
	if [ "$(find . -name "ablunit-test-provider-*.vsix" | wc -l )" = "0" ]; then
		echo "ERROR: could not find .vsix after packaging extension!"
		exit 1
	fi
}

dbus_config () {
	echo "[$0 dbus_config]"
	## These lines fix dbus errors in the logs related to the next section
	## However, they also create new errors
	# apt update
	# apt install -y xdg-desktop-portal

	## These lines fix dbus errors in the logs: https://github.com/microsoft/vscode/issues/190345#issuecomment-1676291938
	service dbus start
	XDG_RUNTIME_DIR=/run/user/$(id -u)
	export XDG_RUNTIME_DIR
	mkdir "$XDG_RUNTIME_DIR"
	chmod 700 "$XDG_RUNTIME_DIR"
	chown "$(id -un)":"$(id -gn)" "$XDG_RUNTIME_DIR"
	export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus
	dbus-daemon --session --address="$DBUS_SESSION_BUS_ADDRESS" --nofork --nopidfile --syslog-only &
}

run_tests () {
	echo "[$0 run_tests] pwd=$(pwd)"
	cd dummy-ext
	npm run compile
	export DONT_PROMPT_WSL_INSTALL=No_Prompt_please
	echo "pwd=$(pwd)"
	ls -al ../
	if ! xvfb-run -a npm run test:install-and-run; then
		if $BASH_AFTER; then
			bash
		fi
		exit 1
	fi
}

########## MAIN BLOCK ##########
initialize "$@"
dbus_config
package_extension
run_tests
echo "[$0] tests completed successfully!"
