#!/bin/bash
set -eou pipefail

intialize () {
    echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	PROJECT_DIR=/home/circleci/project
	REPO_VOLUME=/home/circleci/ablunit-test-runner
    if $CIRCLECI; then
        echo "warning: this does not run in circleci, use the sonar checkout step instead..."
        exit 0
    fi
    BASE_DIR=$(pwd)
	GIT_BRANCH=$(cd "$REPO_VOLUME" && git branch --show-current)
}

main_block () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	git clone "$REPO_VOLUME" "$PROJECT_DIR"
	cd "$PROJECT_DIR"
	if [ "$(git branch --show-current)" = "$GIT_BRANCH" ]; then
		git pull
	else
		git fetch origin "$GIT_BRANCH":"$GIT_BRANCH"
		git checkout "$GIT_BRANCH"
	fi
	copy_files_from_volume
}

copy_files_from_volume () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	find_files_to_copy
	copy_files "staged"
	[ -f /tmp/modified_files ] && copy_files "modified"
	while read -r FILE; do
		echo "deleting deleted file $FILE"
		rm "$FILE"
	done < /tmp/deleted_files
}

find_files_to_copy () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"

	cd "$REPO_VOLUME"
	git config --global --add safe.directory "$REPO_VOLUME"
	git --no-pager diff --diff-filter=d --name-only --staged --ignore-cr-at-eol > /tmp/staged_files
	git --no-pager diff --diff-filter=D --name-only --staged --ignore-cr-at-eol > /tmp/deleted_files
	if ! $STAGED_ONLY; then
		git --no-pager diff --diff-filter=d --name-only --ignore-cr-at-eol > /tmp/modified_files
	fi

	echo "file counts:"
	echo "   staged=$(wc -l /tmp/staged_files)"
	echo "  deleted=$(wc -l /tmp/deleted_files)"
	echo " modified=$(wc -l /tmp/modified_files 2>/dev/null || echo 0)"

	cd "$BASE_DIR"
}

copy_files () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	local TYPE="$1"
	while read -r FILE; do
		echo "copying $TYPE file $FILE"
		if [ ! -d "$(dirname "$FILE")" ]; then
			mkdir -p "$(dirname "$FILE")"
		fi
		sed 's/\r//g' "$REPO_VOLUME/$FILE" > "$FILE"
	done < "/tmp/${TYPE}_files"
}

########## main script ##########
initialize
main_block
echo "[$0] completed successfully!"
