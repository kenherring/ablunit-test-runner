#!/bin/bash
set -eou pipefail

initialize () {
	echo "[$0 initialize]"
	npm install

	echo "\$1=${1:-}"
	if [ "${1:-}" = "webpack" ]; then
		RUNCMD="webpack"
	else
		RUNCMD="build"
	fi
	rm -rf out
	npm run "$RUNCMD"
	echo "npm run $RUNCMD - success"
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
	echo "[$0 run_tests]"
	EXIT_CODE=0

	xvfb-run -a npm test || EXIT_CODE=$?
	if [ "$EXIT_CODE" = "0" ]; then
		echo "xvfb-run success"
	else
		echo "xvfb-run failed (EXIT_CODE=$EXIT_CODE)"
		print_debug_output
		exit $EXIT_CODE
	fi
}

print_debug_output () {
	find . -name "2-ABL Language Server.log" -exec cat {} \;
}

run_lint () {
	echo "[$0 run_lint]"

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
