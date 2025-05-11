#!/bin/bash
set -eou pipefail

## This script is helpful for testing the sonar scan locally
## In the future it would be nice to use `circleci local execute sonar` but it currently requires a lot of
## configuration to get working. This script is a quick way to test the sonar scan locally.

## Prerequisites:
##  - Coverage report in `artifacts/coverage/lcov.info`
##    - This is generate by running `docker/run_tests.sh` or `npm run test`

## Run this script:
##    .circleci/sonar.sh
## Run with debug logging:
##    .circleci/sonar.sh -Dsonar.log.level=DEBUG

. scripts/common.sh

main_block () {
    initialize
    package
    pre_scan
    sonarcloud_scan "$@"
    log_it 'completed successfull!'
}

initialize () {
    log_it
    export SONAR_HOST_URL="https://sonarcloud.io"
    ESLINT_FILE=artifacts/eslint_report.json

    if [ ! -f artifacts/coverage/lcov.info ]; then
        log_error "file not found - artifacts/coverage/lcov.info"
        echo " --- hint:  run 'docker/run_tests.sh'"
        exit 1
    fi
}

package () {
    VSIX_COUNT=$(find . -maxdepth 1 -name "*.vsix" | wc -l)
    log_it "VSIX_COUNT=$VSIX_COUNT"
    DO_PACKAGE=false
    [ "$VSIX_COUNT" != "1" ] && DO_PACKAGE=true
    [ ! -f "$ESLINT_FILE" ] && DO_PACKAGE=true

    log_it "DO_PACKAGE=$DO_PACKAGE"

    if $DO_PACKAGE; then
        .circleci/package.sh
    else
        log_it 'skipping package'
    fi
}

pre_scan () {
    package
    ## fix eslint report paths
    pwd
    ls -al artifacts
    ls -al "${ESLINT_FILE}"
    sed -i 's|/home/circleci/project/|/root/project/|g' "${ESLINT_FILE}"
    ## merge test results into a single file
    scripts/sonar_test_results_merge.sh
    ## remove base dir of /home/circleci/project/
    sed -i 's|/home/circleci/project||g' artifacts/eslint_report.json
    jq . artifacts/eslint_report.json > artifacts/eslint_report_pretty.json

}

sonarcloud_scan () {
    log_it
    VERSION=5.0.1.3006
    SONAR_TOKEN=${SONAR_TOKEN:-}
    if [ -z "$SONAR_TOKEN" ]; then
        log_error 'missing SONAR_TOKEN environment var'
        exit 1
    fi
    SCANNER_DIRECTORY=$(pwd)/tmp/cache/scanner
    mkdir -p "$SCANNER_DIRECTORY"
    export SONAR_USER_HOME=$SCANNER_DIRECTORY/.sonar
    # OS="linux"
    OS="windows"

    if [[ ! -x "$SCANNER_DIRECTORY/sonar-scanner-$VERSION-$OS/bin/sonar-scanner" ]]; then

        curl -l https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-$VERSION-$OS.zip -o "$TEMP/sonar-scanner-cli-$VERSION-$OS.zip"
        unzip -qq -o "$TMP/sonar-scanner-cli-$VERSION-$OS.zip" -d "${SCANNER_DIRECTORY}"
    fi

    SCANNER_EXECUTABLE=sonar-scanner
    [ "$OS" = "windows" ] && SCANNER_EXECUTABLE=sonar-scanner.bat
    SCANNER_EXECUTABLE="$SCANNER_DIRECTORY/sonar-scanner-$VERSION-$OS/bin/$SCANNER_EXECUTABLE"
    chmod +x "$SCANNER_EXECUTABLE" "$SCANNER_DIRECTORY/sonar-scanner-$VERSION-$OS/jre/bin/java"

    cd .
    # "$SCANNER_DIRECTORY/sonar-scanner-$VERSION-$OS/bin/sonar-scanner"

    ARGS=()
    ARGS+=(-Dsonar.branch.name=$(git branch --show-current))
    ARGS+=("$@")
    # ARGS+=(-Dsonar.branch.target=$( git config --get init.defaultBranch))
    "$SCANNER_EXECUTABLE" "${ARGS[@]}"
}

########## MAIN BLOCK ##########
main_block "$@"
