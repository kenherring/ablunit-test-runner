#!/bin/bash
set -eou pipefail

common_init () {
	echo "GITHUB_REF_TYPE=${GITHUB_REF_TYPE:-}"
	echo "GITHUB_REF_NAME=${GITHUB_REF_NAME:-}"
	echo "GITHUB_HEAD_REF=${GITHUB_HEAD_REF:-}"
	echo "GITHUB_REF=${GITHUB_REF:-}"

 	# GITHUB_EVENT_NAME=pull_request
	GITHUB_REF_TYPE="${GITHUB_REF_TYPE:-branch}"
	CIRCLECI=${GITHUB_ACTIONS:-false}
	if [ "$GITHUB_REF_TYPE" = "tag" ]; then
		CIRCLE_BRANCH=
		CIRCLE_TAG="${GITHUB_REF_NAME:-}"
	else ## branch
		CIRCLE_BRANCH="${GITHUB_HEAD_REF:-}"
		CIRCLE_TAG=
	fi

	echo "CIRCLE_TAG=${CIRCLE_TAG:-}"
	echo "CIRCLE_BRANCH=${CIRCLE_BRANCH:-}"
	echo "CIRCLECI=${CIRCLECI:-}"

	[ -z "${CIRCLE_TAG:-}" ] && [ -z "${CIRCLE_BRANCH:-}" ] && CIRCLE_TAG=$(git tag --points-at HEAD)
	[ -z "${CIRCLE_TAG:-}" ] && [ -z "${CIRCLE_BRANCH:-}" ] && CIRCLE_TAG=$(git rev-parse --abbrev-ref HEAD)
	[ -z "${CIRCLE_TAG:-}" ] && [ -z "${CIRCLE_BRANCH:-}" ] && CIRCLE_BRANCH=$(git branch --show-current)

	export CIRCLECI CIRCLE_TAG CIRCLE_BRANCH
}

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

setup_xq () {
	if command -v xq; then
		return
	fi

	log_it "adding ${HOME}/.local/bin to path"
	PATH=$PATH:${HOME}/.local/bin
	if ! command -v xq; then
		log_it "adding /root/.local/bin to path"
		PATH=$PATH:/root/.local/bin
	fi
	if ! command -v xq; then
		log_it 'install xq (via yq)'
		pipx install yq
	fi
	if ! command -v xq; then
		log_error "xq command not found"
		exit 1
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

common_init
