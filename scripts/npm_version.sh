#!/bin/bash
set -eou pipefail

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
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
	echo "args=" "$@"

	set -x
	PRERELEASE=false
    PACKAGE_VERSION=$(node -p "require('./package.json').version")

	if [ "$(git branch --show-current)" = "main" ]; then
		echo "ERROR: cannot be on main branch to run $0"
		exit 1
	fi

	PATCH=${PACKAGE_VERSION##*.}
	if [ "$((PATCH % 2))" = "0" ]; then
		PRERELEASE=true
	fi
}

update_version () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] PACKAGE_VERSION=$PACKAGE_VERSION"

	update_changelog
	git add .
}

update_changelog () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
	local PREVIOUS_VERSION
	PREVIOUS_VERSION=$(grep -Eo '\[v?[0-9]+\.[0-9]+\.[0-9]+\]' CHANGELOG.md | cut -d[ -f2 | cut -d] -f1 | head -1)
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] update CHANGELOG.md from $PREVIOUS_VERSION to $PACKAGE_VERSION"

	local PRERELEASE_TEXT=
	if $PRERELEASE; then
		PRERELEASE_TEXT=" (pre-release)"
	fi

	rm "changelog_$PACKAGE_VERSION.md" 2>/dev/null || true
	{
		echo -e "# [${PACKAGE_VERSION}](https://github.com/kenherring/ablunit-test-runner/releases/tag/${PACKAGE_VERSION}) - $(date +%Y-%m-%d)${PRERELEASE_TEXT}\n"
		git --no-pager log --pretty=format:' * %s' "${PREVIOUS_VERSION}...$(git merge-base origin/main HEAD)"
		gh pr view --json title,number | jq -r '.title + " (" + (.number|tostring) + ")"'
		echo -e "\n\n**Full Changelog**: [${PREVIOUS_VERSION}...${PACKAGE_VERSION}](https://github.com/kenherring/ablunit-test-runner/compare/${PREVIOUS_VERSION}...${PACKAGE_VERSION})\n"
		cat CHANGELOG.md
	} > "changelog_$PACKAGE_VERSION.md"

	rm CHANGELOG.md
	mv "changelog_$PACKAGE_VERSION.md" CHANGELOG.md
	if ! ${CIRCLECI:-false}; then
		code --wait CHANGELOG.md
	fi
}

########## MAIN BLOCK ##########
initialize "$@"
update_version
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] completed successfully!"
