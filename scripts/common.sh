#!/bin/bash
set -eou pipefail

GITHUB_REF_TYPE="${GITHUB_REF_TYPE:-branch}"
CIRCLECI=${CI:-false}
if [ "$GITHUB_REF_TYPE" = "tag" ]; then
	CIRCLE_BRANCH=
	CIRCLE_TAG="$GITHUB_REF_NAME"
else ## branch
	if [ -z "${GITHUB_REF_NAME:-}" ]; then
		GITHUB_REF_NAME=$(git rev-parse --abbrev-ref HEAD)
	fi
	CIRCLE_BRANCH="$GITHUB_REF_NAME"
	CIRCLE_TAG=""
fi
export CIRCLECI CIRCLE_TAG CIRCLE_BRANCH

log_it () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[1]}]" "$@"
}

log_error () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[1]}] ERROR:" "$@" >&2
}

jq () {
	if command -v jq >/dev/null 2>&1; then
		command jq "$@"
	elif command -v jq.exe >/dev/null 2>&1; then
		jq.exe "$@"
	elif command -v jq-windows-amd64.exe >/dev/null 2>&1; then
		jq-windows-amd64.exe "$@"
	else
		log_error "jq not found" >&2
	fi
}

validate_version_updated() {
	log_it 'validating version matches throughout the project...' >&2
	local PACKAGE_VERSION SONAR_PROJECT_VERSION CHANGELOG_VERSION
	PACKAGE_VERSION=$(jq -r '.version' package.json)
	SONAR_PROJECT_VERSION=$(grep -E '^sonar.projectVersion=' sonar-project.properties | cut -d'=' -f2)

	if [ "$PACKAGE_VERSION" != "$SONAR_PROJECT_VERSION" ]; then
		log_error "package.json version ($PACKAGE_VERSION) does not match 'sonar.projectVersion' ($SONAR_PROJECT_VERSION) in 'sonar-project.properties'"
		exit 1
	fi

	CHANGELOG_VERSION=$(head CHANGELOG.md -n 1 | cut -d'[' -f2 | cut -d']' -f1)
	if [ "$PACKAGE_VERSION" != "$CHANGELOG_VERSION" ]; then
		log_error "package.json version ($PACKAGE_VERSION) does not match most recent entry in ($CHANGELOG_VERSION) in 'CHANGELOG.md'"
		exit 1
	fi
}
