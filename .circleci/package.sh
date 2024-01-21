#!/bin/bash
set -euo pipefail

initialize () {
    echo "[$0 ${FUNCNAME[0]}]"
    if [ -z "${CIRCLE_BRANCH:-}" ]; then
        CIRCLE_BRANCH=$(git branch --show-current)
    fi

    npm install
    npm install -g @vscode/vsce || sudo npm install -g @vscode/vsce
}

package () {
    echo "[$0 ${FUNCNAME[0]}]"

    vsce package --githubBranch "$CIRCLE_BRANCH" --no-git-tag-version --pre-release

    # if [ "$(git branch --show-current)" = "main" ]; then
    #     vsce package --githubBranch "$CIRCLE_BRANCH" --no-git-tag-version
    # else
    #     vsce package --githubBranch "$CIRCLE_BRANCH" --no-git-tag-version --pre-release
    # fi

    ## TODO remove me
    if ${VERBOSE:-false}; then
        echo "files in $(pwd):"
        ls -al
    fi
}

########## MAIN BLOCK ##########
initialize
package
echo "[$0] completed successfully"
