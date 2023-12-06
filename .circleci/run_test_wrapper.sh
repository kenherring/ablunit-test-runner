#!/bin/bash
set -eou pipefail

setup () {
	echo 'compile, etc...'
	npm install
	npm run compile
	npm run test:coverage-activation-before
	test_projects/setup.sh
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

npx_eslint () {
	local TYPE=$1
	local OUTFILE=$2
	echo "npx_eslint $TYPE $OUTFILE"

	npx eslint . --ext .ts,.js -f "$TYPE" > "$OUTFILE" || true
	if [[ "$OUTFILE" =~ .json$ ]]; then
		jq '.' < "$OUTFILE" > "${OUTFILE//\.json/_pretty.json}"
	fi
}

run_lint () {
	echo "run_lint"

	mkdir -p artifacts
	rm -rf test_projects/proj7_load_performance/src/ADE-12.2.13.0

	# if ! npx eslint . --ext .ts,.js; then
	# 	echo "eslint failed"
	# fi
	if ! npx_eslint json artifacts/eslint_report_plain.json; then
		echo "eslint plain failed"
	fi
	if ! npx_eslint .circleci/sonarqube_formatter.js artifacts/eslint_report_sonar.json; then
		echo "eslint sonar failed"
	fi
	# if ! npx_eslint junit artifacts/eslint_report_junit.xml; then
	# 	echo "eslint junit failed"
	# fi
}

########## MAIN BLOCK ##########
setup
dbus_config
xvfb-run -a npm test
npm run test:coverage-activation-after
run_lint
