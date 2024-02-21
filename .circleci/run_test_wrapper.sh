#!/bin/bash
set -euo pipefail

initialize () {
	echo "[$0 ${FUNCNAME[0]}]"
	VERBOSE=${VERBOSE:-false}
	export DONT_PROMPT_WSL_INSTALL=No_Prompt_please

	if [ ! -f /root/.rssw/oedoc.bin ]; then
		echo "ERROR: /root/.rssw/oedoc.bin not found"
		exit 1
	fi
	ABLUNIT_TEST_RUNNER_OE_VERSION=$OE_VERSION

	echo "ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"
	echo "ABLUNIT_TEST_RUNNER_VSCODE_VERSION=$ABLUNIT_TEST_RUNNER_VSCODE_VERSION"
	export ABLUNIT_TEST_RUNNER_OE_VERSION ABLUNIT_TEST_RUNNER_VSCODE_VERSION
}

dbus_config () {
	echo "[$0 ${FUNCNAME[0]}]"
	## These lines fix dbus errors in the logs related to the next section
	## However, they also create new errors

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
	echo "[$0 ${FUNCNAME[0]}]"
	EXIT_CODE=0

	cp "package.$ABLUNIT_TEST_RUNNER_VSCODE_VERSION.json" package.json
	xvfb-run -a npm run test:coverage || EXIT_CODE=$?
	cp package.stable.json package.json

	if [ -f /home/circleci/project/test_projects/proj0/prof.out ]; then
		echo "[$0 ${FUNCNAME[0]}] copying profile output prof_${OE_VERSION}.out"
		cp /home/circleci/project/test_projects/proj0/prof.out "/home/circleci/artifacts/prof_${OE_VERSION}.out"
		if [ -f /home/circleci/project/test_projects/proj0/prof.json ]; then
			echo "[$0 ${FUNCNAME[0]}] copying profile output prof_${OE_VERSION}.json"
			cp /home/circleci/project/test_projects/proj0/prof.json "/home/circleci/artifacts/prof_${OE_VERSION}.json"
		fi
	fi

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
	find .vscode-test -name '*-ABL*.log'
	find .vscode-test -name '*-ABL*.log' -exec cp {} artifacts \;
	find .vscode-test -name '*ABLUnit.log'
	find .vscode-test -name '*ABLUnit.log' -exec cp {} artifacts \;
	find .vscode-test -name 'settings.json'
	find .vscode-test -name 'settings.json' -exec cp {} artifacts \;

	find . > artifacts/filelist.txt

	echo "[$0 ${FUNCNAME[0]}] r-code"
	find . -name '*.r'
	$VERBOSE || return 0

	echo "[$0 ${FUNCNAME[0]}] OpenEdge ABL Extension Logs"
	echo "********** '1-ABL.log' **********"
	find . -name "1-ABL.log" -exec cat {} \;
	echo "********** '2-ABL Language Server.log' **********"
	find . -name "2-ABL Language Server.log" -exec cat {} \;
	echo '********** logs done **********'
}

########## MAIN BLOCK ##########
initialize "$@"
dbus_config
run_tests
rm -f artifacts/eslint*
echo "$0 completed successfully!"
