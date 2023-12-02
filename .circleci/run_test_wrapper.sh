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

run_lint () {
	echo "run_lint"
	if ! npx eslint . --ext .ts,.js; then
		echo "eslint failed"
	fi
	if ! npx eslint . --ext .ts,.js -f json | jq '.' > artifacts/eslint_plain_report.json; then
		echo "eslint plain failed"
	fi
	if ! npx eslint . --ext .ts,.js -f .circleci/sonarqube_formatter.js | jq '.' > artifacts/eslint_sonar_report.json; then
		echo "eslint sonar failed"
	fi
	if ! npx eslint . --ext .ts,.js -f junit -o artifacts/eslint.xml; then
		echo "eslint junit failed"
	fi

}

########## MAIN BLOCK ##########
setup
dbus_config
xvfb-run -a npm test
run_lint
