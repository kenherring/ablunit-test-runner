#!/bin/bash
set -eou pipefail

log_timing () {
	echo "[$(date +%Y-%m-%dT%H:%M:%S%z) $0] $1" >> /tmp/timing.log
}

initialize () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
	VERBOSE=${VERBOSE:-false}
	ABLUNIT_TEST_RUNNER_DBUS_NUM=${ABLUNIT_TEST_RUNNER_DBUS_NUM:-3}
	ABLUNIT_TEST_RUNNER_OE_VERSION=${ABLUNIT_TEST_RUNNER_OE_VERSION:-12.8.1}
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}
	ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG=${ABLUNIT_TEST_RUNNER_SCRIPT_FLAG:-true}
	ABLUNIT_TEST_RUNNER_NO_COVERAGE=${ABLUNIT_TEST_RUNNER_NO_COVERAGE:-false}
	ABLUNIT_TEST_RUNNER_UNIT_TESTING=true
	ABLUNIT_TEST_RUNNER_REPO_DIR=$(pwd)

	if [ ! -f /root/.rssw/oedoc.bin ]; then
		echo "ERROR: /root/.rssw/oedoc.bin not found"
		exit 1
	fi

	export ABLUNIT_TEST_RUNNER_DBUS_NUM \
		ABLUNIT_TEST_RUNNER_OE_VERSION \
		ABLUNIT_TEST_RUNNER_VSCODE_VERSION \
		ABLUNIT_TEST_RUNNER_PROJECT_NAME \
		ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG \
		ABLUNIT_TEST_RUNNER_UNIT_TESTING \
		ABLUNIT_TEST_RUNNER_REPO_DIR
	export DONT_PROMPT_WSL_INSTALL VERBOSE

	echo "ABLUNIT_TEST_RUNNER_DBUS_NUM=$ABLUNIT_TEST_RUNNER_DBUS_NUM"
	echo "ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"
	echo "ABLUNIT_TEST_RUNNER_PROJECT_NAME=$ABLUNIT_TEST_RUNNER_PROJECT_NAME"
	echo "ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG=$ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG"
	echo "ABLUNIT_TEST_RUNNER_VSCODE_VERSION=$ABLUNIT_TEST_RUNNER_VSCODE_VERSION"
	echo "ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG=$ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG"
	echo "ABLUNIT_TEST_RUNNER_UNIT_TESTING=$ABLUNIT_TEST_RUNNER_UNIT_TESTING"
	echo "ABLUNIT_TEST_RUNNER_REPO_DIR=$ABLUNIT_TEST_RUNNER_REPO_DIR"

	npm install

	update_oe_version
}

update_oe_version () {
	[ "$ABLUNIT_TEST_RUNNER_OE_VERSION" = '12.2' ] && return 0
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"

	local SHORT_VERSION=${ABLUNIT_TEST_RUNNER_OE_VERSION%.*}
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] SHORT_VERSION=$SHORT_VERSION"

	sed -i "s|\"oeversion\": *\"12.[0-9]\"|\"oeversion\": \"$SHORT_VERSION\"|g" test_projects/*/openedge-project.json
	# ls -al test_projects/*/openedge-project.json
}

restore_vscode_test () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"
	local FROM_DIR TO_DIR COUNT
	FROM_DIR='/home/circleci/.vscode-test'
	if [ ! -d "$FROM_DIR" ]; then
		echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] $FROM_DIR not found, skipping restore"
		return 0
	fi

	TO_DIR=./.vscode-test
	if ! COUNT=$(find "$FROM_DIR" -type f 2>/dev/null | wc -l); then
		COUNT=0
	fi
	$VERBOSE && echo "COUNT=$COUNT"
	if [ "$COUNT" = 0 ]; then
		echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] WARNING: no files found in $FROM_DIR, skipping restore of cached ./.vscode-test/ directory"
		return 0
	fi

	mkdir -p "$TO_DIR"
	cp -r "$FROM_DIR"/* "$TO_DIR"
}

dbus_config () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] ABLUNIT_TEST_RUNNER_DBUS_NUM=$ABLUNIT_TEST_RUNNER_DBUS_NUM"
	case $ABLUNIT_TEST_RUNNER_DBUS_NUM in
		0) dbus_config_0 ;; ## do nothing
		1) dbus_config_1 ;; ## /sbin/start-stop-daemon: signal value must be numeric or name of signal (KILL, INT, ...)
		2) dbus_config_2 ;; ## Failed to connect to the bus: Failed to connect to socket /run/user/0/bus: No such file or directory
		3) dbus_config_3 ;; ## no errors!
		4) dbus_config_4 ;; ## dbus error: Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
		5) dbus_config_5 ;; ## Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
		*) dbus_config_0 ;; ## no errors!
	esac
}

dbug_config_0 () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
}

dbus_config_1 () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
	/sbin/start-stop-daemon --start --quiet --pidfile /tmp/custom_xvfb_99.pid --make-pidfile --background --exec /usr/bin/xvfb – :99 -ac -screen 0 1280x1024x16
}

dbus_config_2 () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
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
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
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
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
	dbus-daemon --config-file=/usr/share/dbus-1/system.conf --print-address
	mkdir -p /var/run/dbus
}

dbus_config_5 () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
	dbus-daemon --system &> /dev/null
	# sudo dbus-daemon --system &> /dev/null
}

run_tests () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] ABLUNIT_TEST_RUNNER_NO_COVERAGE=$ABLUNIT_TEST_RUNNER_NO_COVERAGE; PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}"
	local EXIT_CODE=0

	local RUN_SCRIPT='test:coverage'
	if $ABLUNIT_TEST_RUNNER_NO_COVERAGE; then
		RUN_SCRIPT='test'
	fi
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] starting 'npm $RUN_SCRIPT'"
	if ! xvfb-run -a npm run "$RUN_SCRIPT"; then
		EXIT_CODE=$?
		echo "EXIT_CODE=$EXIT_CODE"
	fi
	log_timing "xvfb-run end (EXIT_CODE=$EXIT_CODE)"

	if ! scripts/sonar_test_results_merge.sh; then
		echo "ERROR: failed to merge test results"
		exit 1
	elif [ ! -f artifacts/mocha_results_sonar/merged.xml ]; then
		echo "ERROR: artifacts/mocha_results_sonar/merged.xml not found"
		exit 1
	else
		echo "SUCCESS: scripts/sonar_test_results_merge.sh completed successfully"
	fi

	if [ ! -f artifacts/coverage/lcov.info ]; then
		mv coverage/lcov.info artifacts/coverage/lcov.info ## https://github.com/microsoft/vscode-test-cli/issues/38
	fi

	log_timing "run_tests end"

	if [ "$EXIT_CODE" = "0" ]; then
		echo "xvfb-run success"
	else
		echo "xvfb-run failed (EXIT_CODE=$EXIT_CODE)"
		save_and_print_debug_output
		exit $EXIT_CODE
	fi

	if ! $ABLUNIT_TEST_RUNNER_NO_COVERAGE && [ ! -s artifacts/coverage/lcov.info ]; then
		echo 'ERROR: artifacts/coverage/lcov.info not found'
		exit 1
	fi

	echo "---------- TIMING ----------"
	cat /tmp/timing.log
}

save_and_print_debug_output () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"

	mkdir -p artifacts
	find . > artifacts/filelist.txt

	find .vscode-test -name '*ABL*.log'
	find .vscode-test -name '*ABL*.log' -exec cp {} artifacts \;
	find .vscode-test -name 'settings.json'
	find .vscode-test -name 'settings.json' -exec cp {} artifacts \;
	local FROM_DIR TO_DIR
	FROM_DIR=$(find .vscode-test  -maxdepth 1 -type d -name 'vscode-*' | tail -1)
	TO_DIR=/home/circleci/.vscode-test/$(basename "$FROM_DIR")
	if [ ! -d "$TO_DIR" ] && [ -n "$FROM_DIR" ]; then
		mkdir -p /home/circleci/.vscode-test/
		cp -r "$FROM_DIR" "$TO_DIR"
	fi

	$VERBOSE || return 0
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] rcode"
	find . -name '*.r'
}

########## MAIN BLOCK ##########
initialize "$@"
dbus_config
run_tests
echo "[$0] completed successfully!"
