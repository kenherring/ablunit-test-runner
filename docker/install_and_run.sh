#!/bin/bash
set -eou pipefail

initialize () {
	tr ' ' '\n' <<< "$PROGRESS_CFG_BASE64" | base64 --decode > /psc/dlc/progress.cfg

	if ! ${CIRCLECI:-false}; then
		echo 'copying files'
		cd /home/circleci/project
		git config --global init.defaultBranch main
		git init
		git remote add origin /home/circleci/ablunit-test-provider
		git fetch origin
		if [ "$GIT_BRANCH" = "$(git branch show-current)" ]; then
			git reset --hard "origin/$GIT_BRANCH"
		else
			git checkout "$GIT_BRANCH"
		fi

		cd /home/circleci/ablunit-test-provider
		git --no-pager diff --diff-filter=d --name-only --staged > /tmp/stage_files
		git --no-pager diff --diff-filter=d --name-only > /tmp/modified_files
		cd -


		while read -r FILE; do
			echo "copying staged file $FILE"
			cp "/home/circleci/ablunit-test-provider/$FILE" "$FILE"
		done < /tmp/stage_files

		while read -r FILE; do
			echo "copying modified file $FILE"
			cp "/home/circleci/ablunit-test-provider/$FILE" "$FILE"
		done < /tmp/modified_files
	fi

	scripts/cleanup.sh

	cp -r .vscode-test dummy-ext/
}

package_extension () {
    npm install -g @vscode/vsce
	vsce package --pre-release --githubBranch "$(git branch --show-current)"
}

dbus_config () {
	echo "dbus_config"
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
	echo "starting 'test:install-and-run'..."
	test_projects/setup.sh
	cd dummy-ext
	npm run compile
	export DONT_PROMPT_WSL_INSTALL=No_Prompt_please
	xvfb-run -a npm run test:install-and-run
}

finish () {
	echo 'done running tests'
}

########## MAIN BLOCK ##########
initialize "$@"
dbus_config
package_extension
run_tests
finish
