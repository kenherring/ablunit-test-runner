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
	echo "args=" "$@"
	PRE_RELEASE=false
	CIRCLE_BUILD_NUM=${CIRCLE_BUILD_NUM:-}
	PACKAGE_VERSION=$(jq -r '.version' package.json | cut -d'-' -f1)

	# MAJOR=$(echo "$PACKAGE_VERSION" | awk -F. '{print $1}')
	MINOR=$(echo "$PACKAGE_VERSION" | awk -F. '{print $2}')
	# PATCH=$(echo "$PACKAGE_VERSION" | awk -F. '{print $3}')

	if [ "$(( MINOR % 1 ))" = "0" ]; then
		PRE_RELEASE=true
	fi
	# remove_unpushed_tags ##TODO
}

remove_unpushed_tags () {
	echo "[$0 ${FUNCNAME[0]}]"
	git fetch --prune origin +refs/tags/*:refs/tags/*
}

update_version () {
	echo "[$0 ${FUNCNAME[0]}] PACKAGE_VERSION=$PACKAGE_VERSION, CIRCLE_BUILD_NUM=$CIRCLE_BUILD_NUM"

	update_changelog
	update_other_files
	git add .
}

update_changelog () {
	echo "[$0 ${FUNCNAME[0]}]"
	local PREVIOUS_VERSION
	PREVIOUS_VERSION=$(grep -Eo '\[v[0-9]+\.[0-9]+\.[0-9]+\]' CHANGELOG.md | cut -dv -f2 | cut -d] -f1 | head -1)
	echo "[$0 ${FUNCNAME[0]}] update CHANGELOG.md from $PREVIOUS_VERSION to $PACKAGE_VERSION"

	local PRE_RELEASE_TEXT=
	if $PRE_RELEASE; then
		PRE_RELEASE_TEXT=" (pre-release)"
	fi

	rm "changelog_$PACKAGE_VERSION.md" 2>/dev/null || true
	{
		echo -e "# [v${PACKAGE_VERSION}](https://github.com/kenherring/ablunit-test-runner/releases/tag/v${PACKAGE_VERSION}) - $(date +%Y-%m-%d)${PRE_RELEASE_TEXT}\n"
		git log --pretty=format:' * %s' "${PREVIOUS_VERSION}" "$(git merge-base origin/main HEAD)"
		echo -e "\n\n**Full Changelog**: [v${PREVIOUS_VERSION}...v${PACKAGE_VERSION}](https://github.com/kenherring/ablunit-test-runner/compare/v${PREVIOUS_VERSION}...v${PACKAGE_VERSION})\n"
		cat CHANGELOG.md
	} > "changelog_$PACKAGE_VERSION.md"

	rm CHANGELOG.md
	mv "changelog_$PACKAGE_VERSION.md" CHANGELOG.md
}

update_other_files () {
	echo "[$0 ${FUNCNAME[0]}] updating sonar-project.properties..."
	sed -i "s/sonar.projectVersion=.*/sonar.projectVersion=$PACKAGE_VERSION/" sonar-project.properties

	## TODO
	echo "[$0 ${FUNCNAME[0]}] updating src/version.ts..."
	echo "export const LIB_VERSION = '$PACKAGE_VERSION'" > src/version.ts

	echo "[$0 ${FUNCNAME[0]}] updating .vscode/launch.json..."
	sed -i "s/ablunit-test-runner-.*.vsix/ablunit-test-runner-$PACKAGE_VERSION.vsix/" .vscode/launch.json
}

########## MAIN BLOCK ##########
initialize "$@"
update_version
echo "[$0] completed successfully!"
