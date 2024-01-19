#!/bin/sh
set -euo pipefail

jq () {
	if command jq >/dev/null 2>&1; then
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
	echo "validating version matches throughout the project..." >&2
	PACKAGE_VERSION=$(jq -r '.version' package.json)
	TAG_VERSION=$(git tag | tail -1)
	SONAR_PROJECT_VERSION=$(grep -E '^sonar.projectVersion=' sonar-project.properties | cut -d'=' -f2)

	if [ "$PACKAGE_VERSION" = "$TAG_VERSION" ]; then
		echo "ERROR: package.json version ($PACKAGE_VERSION) matches latest git tag ($TAG_VERSION) and should be updated" >&2
		exit 1
	fi
	if [ "$PACKAGE_VERSION" != "$SONAR_PROJECT_VERSION" ]; then
		echo "ERROR: package.json version ($PACKAGE_VERSION) does not match 'sonar.projectVersion' ($SONAR_PROJECT_VERSION) in sonar-project.properties" >&2
		exit 1
	fi

	if ! head CHANGELOG.md -n 1 | grep "$TAG_VERSION" >/dev/null 2>&1; then
		if [ "${CIRCLE_TAG:-}" != "" ]; then
			echo "ERROR: CHANGELOG.md does not match the latest git tag ($TAG_VERSION)" >&2
			exit 1
		else
			echo "WARNING: changelog first line matches latest git tag ($TAG_VERSION) and should be updated" >&2
		fi
	fi
}
