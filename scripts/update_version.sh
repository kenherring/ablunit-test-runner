#!/bin/bash
set -euo pipefail

. scripts/common.sh

usage () {
	local EXIT_CODE="${1:-0}"
	echo "usage: $0 [--pre-release | -p] [--help | -h]"
	echo "  --[p]re-release         create a pre-release package"
	echo "  --[v]ersion <version>   specify a version to use"
	echo "  --[h]elp                print this message"
	exit "$EXIT_CODE"
}

initialize () {
	echo "[$0 ${FUNCNAME[0]}]"
	local OPT OPTARG OPTIND
	PRE_RELEASE=false
	CIRCLECI=${CIRCLECI:-false}

	while getopts "hpv:-:" OPT; do
		case "$OPT" in
			-)	case "${OPTARG}" in
					help)			usage ;;
					pre-release) 	PRE_RELEASE=true ;;
					version)		NEW_VERSION="${!OPTIND}"; OPTIND=$((OPTIND + 1)) ;;
					*)	echo "invalid option: --${OPTARG}"; usage 1 ;;
				esac ;;
			h)	usage ;;
			p)	PRE_RELEASE=true ;;
			v)	NEW_VERSION="${OPTARG}" ;;
			*)	echo "invalid option: -$OPTARG"; usage 1 ;;
		esac
	done

	echo "initializing update-version script..."

	CURRENT_VERSION=$(jq -r '.version' package.json | cut -d'-' -f1)

	if [ "${NEW_VERSION:-}" = "patch" ] || $PRE_RELEASE; then
		if $CIRCLECI && [ -z "${CIRCLE_BUILD_NUM:-}" ]; then
			echo "ERROR: environment variable \$CIRCLE_BUILD_NUM not set" >&2
			exit 1
		fi
	fi
	if $PRE_RELEASE; then
		if git ls-remote --tags origin "v$CURRENT_VERSION" | grep "v$CURRENT_VERSION"; then
			echo "ERROR: tag 'v$CURRENT_VERSION' already exists... exiting" >&2
			echo "       use '$0 patch' to bump the version" >&2
			exit 1
		fi
	else
		if [ -z "${NEW_VERSION:-}" ]; then
			NEW_VERSION="patch"
		fi
	fi
}

update_version () {
	echo "[$0 ${FUNCNAME[0]}]"
	echo "CURRENT_VERSION=$CURRENT_VERSION, CIRCLE_BUILD_NUM=${CIRCLE_BUILD_NUM:-}"

	if [ -z "$CURRENT_VERSION" ]; then
		echo "ERROR: could not determine current version from package.json... exiting" >&2
		exit 1
	fi

	if [ -n "${PIPELINE_GIT_TAG:-}" ]; then
		create_package_for_tag
	elif [ "${NEW_VERSION:-}" = "major" ] || [ "${NEW_VERSION:-}" = "minor" ] || [ "${NEW_VERSION:-}" = "patch" ]; then
		npm version "$NEW_VERSION" --no-git-tag-version
	else
		npm version "$CURRENT_VERSION-${CIRCLE_BUILD_NUM:-}" --no-git-tag-version
	fi

	NEW_VER=$(jq -r '.version' package.json)
	echo  "[$0 ${FUNCNAME[0]}] updated package version from '$CURRENT_VERSION' to '$NEW_VER'"

	if [ "${NEW_VERSION:-}" = "minor" ] || [ "${NEW_VERSION:-}" = "patch" ]; then
		update_changelog
	fi

	update_other_files "$NEW_VER"
}

create_package_for_tag () {
	echo "[$0 ${FUNCNAME[0]}]"
	if [ "$PRE_RELEASE" = true ]; then
		echo "pre-release detected..."
		exit 0
	else
		sed -i 's,"preview": true,"preview": false,g' package.json
	fi
	echo "[create-package-for-tag] FUNCTION NOT IMPLEMENTED YET"
}

update_other_files () {
	echo "[$0 ${FUNCNAME[0]}] updating sonar-project.properties..."
	sed -i "s/sonar.projectVersion=.*/sonar.projectVersion=$1/" sonar-project.properties

	echo "[$0 ${FUNCNAME[0]}] updating src/version.ts..."
	echo "export const LIB_VERSION = '$1'" > src/version.ts

	echo "[$0 ${FUNCNAME[0]}] updating .vscode/launch.json..."
	sed -i "s/ablunit-test-runner-.*.vsix/ablunit-test-runner-$1.vsix/" .vscode/launch.json dummy-ext/src/test/installAndRun.ts
}

update_changelog () {
	echo "[$0 ${FUNCNAME[0]}]"
	local PACKAGE_VERSION=$NEW_VER
	local PREVIOUS_VERSION
	PREVIOUS_VERSION=$(grep -Eo '\[v[0-9]+\.[0-9]+\.[0-9]+\]' CHANGELOG.md | cut -dv -f2 | cut -d] -f1 | head -1)
	echo "[$0 ${FUNCNAME[0]}] update_changelog from $PREVIOUS_VERSION to $PACKAGE_VERSION"
	MAJOR=$(echo "$PACKAGE_VERSION" | awk -F. '{print $1}')
	MINOR=$(echo "$PACKAGE_VERSION" | awk -F. '{print $2}')
	PATCH=$(echo "$PACKAGE_VERSION" | awk -F. '{print $3}')

	#TODO
	echo "MAJOR=$MAJOR, MINOR=$MINOR, PATCH=$PATCH" >&2


	PRE_RELEASE=
	echo "MINOR-modulo-1=$((MINOR % 1))" >&2
	if [ "$(( MINOR % 1 ))" = "0" ]; then
		PRE_RELEASE=" (pre-release)"
	fi

	rm "changelog_$PACKAGE_VERSION.md" 2>/dev/null || true
	{
		echo -e "# [v${PACKAGE_VERSION}](https://github.com/kenherring/ablunit-test-runner/releases/tag/v${PACKAGE_VERSION}) - $(date +%Y-%m-%d)${PRE_RELEASE}\n"
		git log --pretty=format:' * %s' "v${PREVIOUS_VERSION}..HEAD"
		echo -e "\n\n**Full Changelog**: [v${PREVIOUS_VERSION}...v${PACKAGE_VERSION}](https://github.com/kenherring/ablunit-test-runner/compare/v${PREVIOUS_VERSION}...v${PACKAGE_VERSION})\n"
		cat CHANGELOG.md
	} > "changelog_$PACKAGE_VERSION.md"

	rm CHANGELOG.md
	mv "changelog_$PACKAGE_VERSION.md" CHANGELOG.md
}

########## MAIN BLOCK ##########
initialize "$@"
update_version
echo "[$0] completed successfully!"
