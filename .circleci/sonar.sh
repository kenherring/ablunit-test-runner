#!/bin/bash
set -eou pipefail

sonarcloud_scan () {
    VERSION=5.0.1.3006
    SONAR_TOKEN=${SONAR_TOKEN:-}
    if [ -z "$SONAR_TOKEN" ]; then
        echo "ERROR: missing SONAR_TOKEN environment var"
        exit 1
    fi
    SCANNER_DIRECTORY=$(pwd)/tmp/cache/scanner
    mkdir -p "$SCANNER_DIRECTORY"
    export SONAR_USER_HOME=$SCANNER_DIRECTORY/.sonar
    # OS="linux"
    OS="windows"

    if [[ ! -x "$SCANNER_DIRECTORY/sonar-scanner-$VERSION-$OS/bin/sonar-scanner" ]]; then
    curl -Ol https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-$VERSION-$OS.zip
    unzip -qq -o sonar-scanner-cli-$VERSION-$OS.zip -d $SCANNER_DIRECTORY
    fi

    # chmod +x "$SCANNER_DIRECTORY/sonar-scanner-$VERSION-$OS/bin/sonar-scanner"
    chmod +x "$SCANNER_DIRECTORY/sonar-scanner-$VERSION-$OS/bin/sonar-scanner.bat"
    chmod +x "$SCANNER_DIRECTORY/sonar-scanner-$VERSION-$OS/jre/bin/java"

    cd .
    # "$SCANNER_DIRECTORY/sonar-scanner-$VERSION-$OS/bin/sonar-scanner"
    "$SCANNER_DIRECTORY/sonar-scanner-$VERSION-$OS/bin/sonar-scanner.bat"
}

########## MAIN BLOCK ##########
# scripts/sonar_test_results_merge.sh
export SONAR_HOST_URL="https://sonarcloud.io"

sonarcloud_scan
