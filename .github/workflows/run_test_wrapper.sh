#!/bin/bash
set -eou pipefail

. scripts/common.sh

initialize () {
	log_it "whoami=$(whoami)"
	VERBOSE=${VERBOSE:-false}
	VERBOSE=true
	DONT_PROMPT_WSL_INSTALL=No_Prompt_please
	PRIMARY_OE_VERSION=${PRIMARY_OE_VERSION:-12.8.1}
	ABLUNIT_TEST_RUNNER_DBUS_NUM=${ABLUNIT_TEST_RUNNER_DBUS_NUM:-3}
	ABLUNIT_TEST_RUNNER_OE_VERSION=${ABLUNIT_TEST_RUNNER_OE_VERSION:-}
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}
	ABLUNIT_TEST_RUNNER_REPO_DIR=$(pwd)
	ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG=${ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG:-true}
	ABLUNIT_TEST_RUNNER_UNIT_TESTING=true
	# HOME=/home/circleci
	HOME=/github/home

	if [ "$ABLUNIT_TEST_RUNNER_OE_VERSION" != "$PRIMARY_OE_VERSION" ]; then
		ABLUNIT_TEST_RUNNER_NO_COVERAGE=${ABLUNIT_TEST_RUNNER_NO_COVERAGE:-true}
	fi
	ABLUNIT_TEST_RUNNER_NO_COVERAGE=${ABLUNIT_TEST_RUNNER_NO_COVERAGE:-false}

	if [ ! -f /root/.rssw/oedoc.bin ]; then
		log_error "/root/.rssw/oedoc.bin not found"
		exit 1
	fi

	export ABLUNIT_TEST_RUNNER_DBUS_NUM \
		ABLUNIT_TEST_RUNNER_OE_VERSION \
		ABLUNIT_TEST_RUNNER_PROJECT_NAME \
		ABLUNIT_TEST_RUNNER_REPO_DIR \
		ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG \
		ABLUNIT_TEST_RUNNER_UNIT_TESTING
	export DONT_PROMPT_WSL_INSTALL VERBOSE

	log_it "ABLUNIT_TEST_RUNNER_DBUS_NUM=$ABLUNIT_TEST_RUNNER_DBUS_NUM"
	log_it "ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"
	log_it "ABLUNIT_TEST_RUNNER_PROJECT_NAME=$ABLUNIT_TEST_RUNNER_PROJECT_NAME"
	log_it "ABLUNIT_TEST_RUNNER_REPO_DIR=$ABLUNIT_TEST_RUNNER_REPO_DIR"
	log_it "ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG=$ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG"
	log_it "ABLUNIT_TEST_RUNNER_UNIT_TESTING=$ABLUNIT_TEST_RUNNER_UNIT_TESTING"
	log_it "CI=${CI:-}"

	update_oe_version

	tr ' ' '\n' <<< "$PROGRESS_CFG_BASE64" | base64 --decode > /psc/dlc/progress.cfg
}

update_oe_version () {
	[ "$ABLUNIT_TEST_RUNNER_OE_VERSION" = '12.2' ] && return 0
	log_it "ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"

	local SHORT_VERSION=${ABLUNIT_TEST_RUNNER_OE_VERSION%.*}
	log_it "SHORT_VERSION=$SHORT_VERSION"

	sed -i "s|\"oeversion\": *\"12.[0-9]\"|\"oeversion\": \"$SHORT_VERSION\"|g" test_projects/*/openedge-project.json
	# ls -al test_projects/*/openedge-project.json
}

dbus_config () {
	log_it "ABLUNIT_TEST_RUNNER_DBUS_NUM=$ABLUNIT_TEST_RUNNER_DBUS_NUM"
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
	log_it
	/sbin/start-stop-daemon --start --quiet --pidfile /tmp/custom_xvfb_99.pid --make-pidfile --background --exec /usr/bin/xvfb – :99 -ac -screen 0 1280x1024x16
}

dbus_config_2 () {
	log_it
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
	log_it
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
	log_it
	dbus-daemon --config-file=/usr/share/dbus-1/system.conf --print-address
	mkdir -p /var/run/dbus
}

dbus_config_5 () {
	log_it
	dbus-daemon --system &> /dev/null
	# sudo dbus-daemon --system &> /dev/null
}

run_tests () {
	log_it "ABLUNIT_TEST_RUNNER_NO_COVERAGE=$ABLUNIT_TEST_RUNNER_NO_COVERAGE"

	local RUN_SCRIPT=test:coverage
	if $ABLUNIT_TEST_RUNNER_NO_COVERAGE; then
		RUN_SCRIPT='test'
	fi

	## without this cpstream=UTF-8 and cpstream=US-ASCII
	if ${DOCKER:-}; then
		export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:-'-Dfile.encoding=UTF8'}
	fi

	log_it "starting 'npm $RUN_SCRIPT'"
	EXIT_CODE=0
	xvfb-run -a npm run "$RUN_SCRIPT" || EXIT_CODE=$?
	log_it "xvfb-run end (EXIT_CODE=$EXIT_CODE)"

	if [ "$RUN_SCRIPT" = 'test:coverage' ]; then
		mv coverage/lcov.info artifacts/coverage/lcov.info || true ## https://github.com/microsoft/vscode-test-cli/issues/38
	fi

	if [ "$EXIT_CODE" = "0" ]; then
		log_it "xvfb-run success"
	else
		log_error "xvfb-run failed (EXIT_CODE=$EXIT_CODE)"
		save_and_print_debug_output
	fi

	if ! $ABLUNIT_TEST_RUNNER_NO_COVERAGE && [ ! -s artifacts/coverage/lcov.info ]; then
		log_error 'artifacts/coverage/lcov.info not found'
		EXIT_CODE=90
	fi
}

save_and_print_debug_output () {
	log_it

	mkdir -p artifacts
	$VERBOSE && find . > artifacts/filelist.txt

	find .vscode-test -name '*ABL*.log'
	find .vscode-test -name '*ABL*.log' -exec cp {} artifacts \;
	find .vscode-test -name 'settings.json'
	find .vscode-test -name 'settings.json' -exec cp {} artifacts \;
	local FROM_DIR TO_DIR
	FROM_DIR=$(find .vscode-test  -maxdepth 1 -type d -name 'vscode-*' | tail -1)
	TO_DIR="$HOME"/.vscode-test/$(basename "$FROM_DIR")
	if [ ! -d "$TO_DIR" ] && [ -n "$FROM_DIR" ]; then
		mkdir -p "$HOME"/.vscode-test/
		cp -r "$FROM_DIR" "$TO_DIR"
	fi

	$VERBOSE || return 0
	log_it "rcode:"
	find . -name '*.r'
}

process_exit_code () {
	if [ "${EXIT_CODE:-0}" = 0 ]; then
		log_it "all tests completed successfully!"
		exit 0
	fi
	log_error "failed with exit code $EXIT_CODE"
	exit ${EXIT_CODE:-255}
}

########## MAIN BLOCK ##########
initialize "$@"
dbus_config
run_tests
scripts/sonar_test_results_merge.sh
process_exit_code
