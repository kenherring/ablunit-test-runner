#!/bin/bash
set -euo pipefail

initialize () {
	echo "[$0 ${FUNCNAME[0]}]"
	VERBOSE=${VERBOSE:-false}
	DONT_PROMPT_WSL_INSTALL=No_Prompt_please
	ABLUNIT_TEST_RUNNER_DBUS_NUM=${ABLUNIT_TEST_RUNNER_DBUS_NUM:-3}
	ABLUNIT_TEST_RUNNER_OE_VERSION=${ABLUNIT_TEST_RUNNER_OE_VERSION:-}
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}
	ABLUNIT_TEST_RUNNER_SCRIPT_FLAG=${ABLUNIT_TEST_RUNNER_SCRIPT_FLAG:-true}
	ABLUNIT_TEST_RUNNER_VSCODE_VERSION=${ABLUNIT_TEST_RUNNER_VSCODE_VERSION:-}
	if [ -z "$ABLUNIT_TEST_RUNNER_OE_VERSION" ]; then
		ABLUNIT_TEST_RUNNER_OE_VERSION=${OE_VERSION:-12.2.12}
	fi

	if [ ! -f /root/.rssw/oedoc.bin ]; then
		echo "ERROR: /root/.rssw/oedoc.bin not found"
		exit 1
	fi

	export DONT_PROMPT_WSL_INSTALL \
		ABLUNIT_TEST_RUNNER_DBUS_NUM \
		ABLUNIT_TEST_RUNNER_OE_VERSION \
		ABLUNIT_TEST_RUNNER_PROJECT_NAME \
		ABLUNIT_TEST_RUNNER_SCRIPT_FLAG \
		ABLUNIT_TEST_RUNNER_VSCODE_VERSION
	export DONT_PROMPT_WSL_INSTALL VERBOSE

	if [ -z "$ABLUNIT_TEST_RUNNER_OE_VERSION" ]; then
		ABLUNIT_TEST_RUNNER_OE_VERSION=$OE_VERSION
	fi

	echo "ABLUNIT_TEST_RUNNER_DBUS_NUM=$ABLUNIT_TEST_RUNNER_DBUS_NUM"
	echo "ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"
	echo "ABLUNIT_TEST_RUNNER_PROJECT_NAME=$ABLUNIT_TEST_RUNNER_PROJECT_NAME"
	echo "ABLUNIT_TEST_RUNNER_SCRIPT_FLAG=$ABLUNIT_TEST_RUNNER_SCRIPT_FLAG"
	echo "ABLUNIT_TEST_RUNNER_VSCODE_VERSION=$ABLUNIT_TEST_RUNNER_VSCODE_VERSION"

	npm install

	echo "[$0 ${FUNCNAME[0]}] update_oe_version start"
	update_oe_version
	restore_vscode_test
	echo "[$0 ${FUNCNAME[0]}] update_oe_version end"
	# exit 1
}

update_oe_version () {
	[ "$ABLUNIT_TEST_RUNNER_OE_VERSION" = '12.2' ] && return 0
	echo "[$0 ${FUNCNAME[0]}] ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"

	local SHORT_VERSION=${ABLUNIT_TEST_RUNNER_OE_VERSION%.*}
	echo "[$0 ${FUNCNAME[0]}] SHORT_VERSION=$SHORT_VERSION"

	sed -i "s/\"12.2\"/\"$SHORT_VERSION\"/g" test_projects/*/openedge-project.json
	# ls -al test_projects/*/openedge-project.json
}

restore_vscode_test () {
	echo "[$0 ${FUNCNAME[0]}] ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"
	local FROM_DIR TO_DIR COUNT
	FROM_DIR='/home/circleci/.vscode-test'
	TO_DIR=./.vscode-test
	if ! COUNT=$(find "$FROM_DIR" -type f 2>/dev/null | wc -l); then
		COUNT=0
	fi
	$VERBOSE && echo "COUNT=$COUNT"
	if [ "$COUNT" = 0 ]; then
		return 0
	fi
	cp -r "$FROM_DIR"/* "$TO_DIR"
}

dbus_config () {
	echo "[$0 ${FUNCNAME[0]}] ABLUNIT_TEST_RUNNER_DBUS_NUM=$ABLUNIT_TEST_RUNNER_DBUS_NUM"
	case $ABLUNIT_TEST_RUNNER_DBUS_NUM in
		1) dbus_config_1 ;; ## /sbin/start-stop-daemon: signal value must be numeric or name of signal (KILL, INT, ...)
		2) dbus_config_2 ;; ## Failed to connect to the bus: Failed to connect to socket /run/user/0/bus: No such file or directory
		3) dbus_config_3 ;; ## no errors!
		4) dbus_config_4 ;; ## dbus error: Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
		5) dbus_config_5 ;; ## Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
		*) dbus_config_3 ;; ## no errors!
	esac
}

dbus_config_1 () {
	echo "[$0 ${FUNCNAME[0]}]"
	/sbin/start-stop-daemon --start --quiet --pidfile /tmp/custom_xvfb_99.pid --make-pidfile --background --exec /usr/bin/xvfb – :99 -ac -screen 0 1280x1024x16
}

dbus_config_2 () {
	echo "[$0 ${FUNCNAME[0]}]"
	## These lines fix dbus errors in the logs related to the next section
	## However, they also create new errors

	## These lines fix dbus errors in the logs: https://github.com/microsoft/vscode/issues/190345#issuecomment-1676291938
	service dbus start
	XDG_RUNTIME_DIR=/run/user/$(id -u)
	export XDG_RUNTIME_DIR
	mkdir -p "$XDG_RUNTIME_DIR"
	chmod 700 "$XDG_RUNTIME_DIR"
	chown "$(id -un)":"$(id -gn)" "$XDG_RUNTIME_DIR"
	export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus
	dbus-daemon --quiet --session --address="$DBUS_SESSION_BUS_ADDRESS" --nofork --nopidfile --syslog-only &
}

dbus_config_3 () {
	echo "[$0 ${FUNCNAME[0]}]"
	DISPLAY=$(grep nameserver /etc/resolv.conf | awk '{print $2}'):0.0
	export DISPLAY
	service dbus restart
	# sudo service dbus restart

	XDG_RUNTIME_DIR=/run/user/$(id -u)
	export XDG_RUNTIME_DIR
	if [ ! -d "$XDG_RUNTIME_DIR" ]; then
		mkdir "$XDG_RUNTIME_DIR"
		chmod 700 "$XDG_RUNTIME_DIR"
		chown "$(id -un)":"$(id -gn)" "$XDG_RUNTIME_DIR"
		# sudo mkdir "$XDG_RUNTIME_DIR"
		# sudo chmod 700 "$XDG_RUNTIME_DIR"
		# sudo chown "$(id -un)":"$(id -gn)" "$XDG_RUNTIME_DIR"
	fi

	DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus
	export DBUS_SESSION_BUS_ADDRESS
	dbus-daemon --session --address="$DBUS_SESSION_BUS_ADDRESS" --nofork --nopidfile --syslog-only &
}

dbus_config_4 () {
	echo "[$0 ${FUNCNAME[0]}]"
	dbus-daemon --config-file=/usr/share/dbus-1/system.conf --print-address
	mkdir -p /var/run/dbus
}

dbus_config_5 () {
	echo "[$0 ${FUNCNAME[0]}]"
	dbus-daemon --system &> /dev/null
	# sudo dbus-daemon --system &> /dev/null
}

run_tests () {
	echo "[$0 ${FUNCNAME[0]}]"
	EXIT_CODE=0

	cp "package.$ABLUNIT_TEST_RUNNER_VSCODE_VERSION.json" package.json
	if ${ABLUNIT_TEST_RUNNER_NO_COVERAGE:-false}; then
		time xvfb-run -a npm test
	else
		time xvfb-run -a npm run test:coverage
	fi | sed -e 's,/?home/circleci/project/,,g' || EXIT_CODE=$?
	cp package.stable.json package.json

	if [ "$EXIT_CODE" = "0" ]; then
		echo "xvfb-run success"
	else
		echo "xvfb-run failed (EXIT_CODE=$EXIT_CODE)"
		save_and_print_debug_output
		exit $EXIT_CODE
	fi
}

save_and_print_debug_output () {
	echo "[$0 ${FUNCNAME[0]}]"

	mkdir -p artifacts
	find . > artifacts/filelist.txt

	find .vscode-test -name '*ABL*.log'
	find .vscode-test -name '*ABL*.log' -exec cp {} artifacts \;
	find .vscode-test -name 'settings.json'
	find .vscode-test -name 'settings.json' -exec cp {} artifacts \;
	local FROM_DIR TO_DIR
	FROM_DIR=$(find .vscode-test  -maxdepth 1 -type d -name 'vscode-*')
	TO_DIR=/home/circleci/.vscode-test/$(basename "$FROM_DIR")
	if [ ! -d "$TO_DIR" ]; then
		cp -r "$FROM_DIR" "$TO_DIR"
	fi

	$VERBOSE || return 0
	echo "[$0 ${FUNCNAME[0]}] r-code"
	find . -name '*.r'
}

########## MAIN BLOCK ##########
initialize "$@"
dbus_config
run_tests
# rm -f artifacts/eslint*
echo "$0 completed successfully!"
