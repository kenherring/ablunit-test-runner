#!/bin/bash
set -euo pipefail

initialize () {
    echo "[$0 ${FUNCNAME[0]}]"

    npm install
    npm install -g @vscode/vsce || sudo npm install -g @vscode/vsce
}

package () {
    echo "[$0 ${FUNCNAME[0]}]"

    if [ "$(git branch --show-current)" = "main" ]; then
        vsce package --githubBranch "$CIRCLE_BRANCH" --no-git-tag-version
    else
        vsce package --githubBranch "$CIRCLE_BRANCH" --no-git-tag-version --pre-release
    fi
    ## TODO remove me
    ls -al
}

########## MAIN BLOCK ##########
initialize
package
echo "[$0] completed successfully"
