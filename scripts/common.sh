#!/bin/bash
set -euo pipefail

jq () {
	if command -v jq >/dev/null 2>&1; then
		command jq "$@"
	elif command -v jq.exe >/dev/null 2>&1; then
		jq.exe "$@"
	elif command -v jq-windows-amd64.exe >/dev/null 2>&1; then
		jq-windows-amd64.exe "$@"
	else
		echo "jq not found" >&2
	fi
}

validate_version_updated() {
	echo "[$0 ${FUNCNAME[0]}] validating version matches throughout the project..." >&2
	local PACKAGE_VERSION SONAR_PROJECT_VERSION CHANGELOG_VERSION
	PACKAGE_VERSION=$(jq -r '.version' package.json)
	SONAR_PROJECT_VERSION=$(grep -E '^sonar.projectVersion=' sonar-project.properties | cut -d'=' -f2)

	if [ "$PACKAGE_VERSION" != "$SONAR_PROJECT_VERSION" ]; then
		echo "[$0 ${FUNCNAME[0]}] ERROR: package.json version ($PACKAGE_VERSION) does not match 'sonar.projectVersion' ($SONAR_PROJECT_VERSION) in 'sonar-project.properties'" >&2
		exit 1
	fi

	CHANGELOG_VERSION=$(head CHANGELOG.md -n 1 | cut -d'[' -f2 | cut -d']' -f1)
	if [ "$PACKAGE_VERSION" != "$CHANGELOG_VERSION" ]; then
		echo "[$0 ${FUNCNAME[0]}] ERROR: package.json version ($PACKAGE_VERSION) does not match most recent entry in ($CHANGELOG_VERSION) in 'CHANGELOG.md'" >&2
		exit 1
	fi
}
