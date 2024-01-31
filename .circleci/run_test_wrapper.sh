#!/bin/bash
set -euo pipefail

initialize () {
	echo "[$0 ${FUNCNAME[0]}]"
	VERBOSE=${VERBOSE:-false}
	export DONT_PROMPT_WSL_INSTALL=No_Prompt_please
	npm install
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

	xvfb-run -a npm test || EXIT_CODE=$?
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

run_lint () {
	echo "[$0 ${FUNCNAME[0]}]"
	if [ -n "${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}" ]; then
		echo "[$0 ${FUNCNAME[0]}] skipping lint for single ABLUnit test runner project test"
		return 0
	fi

	mkdir -p artifacts
	rm -rf test_projects/proj7_load_performance/src/ADE-12.2.13.0

	if ! npm run lint -o artifacts/eslint_report.txt; then
		echo "eslint failed"
	fi
	if ! npm run lint -- -f json -o artifacts/eslint_report.json; then
		echo "eslint plain failed"
	fi
	if [ -f artifacts/eslint_report.json ]; then
		jq '.' < artifacts/eslint_report.json > artifacts/eslint_report_pretty.json
	else
		echo "ERROR: eslint_report.txt not found"
		exit 1
	fi
}

########## MAIN BLOCK ##########
initialize "$@"
dbus_config
run_tests
run_lint
echo "$0 completed successfully!"
