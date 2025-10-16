#!/bin/bash
set -eou pipefail

. scripts/common.sh

initialize () {
    log_it
    rm -f artifacts/mocha_results_sonar/merged*.xml
    if ! find artifacts/mocha_results_sonar -type f -name "*.xml"; then
        log_error "no *.xml files found in artifacts/mocha_results_sonar"
        exit 1
    else
        echo "Directory is empty"
    fi

    install_xq
}

convert_and_merge_xml () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"

    ## Merge for sonar
    {
        echo '<?xml version="1.0" encoding="UTF-8"?>'
        echo '<testExecutions version="1">'
        cat artifacts/mocha_results_sonar/*.xml | sed 's,>,>\n,g' | grep -v '</*testExecutions' | grep -v 'xml version'
        echo '</testExecutions>'
    } > artifacts/mocha_results_sonar/merged

    sed -i 's,<skipped></skipped>,<skipped/>,g' artifacts/mocha_results_sonar/merged
    sed -i 's,<skipped/>,<skipped message="skipped"/>,g' artifacts/mocha_results_sonar/merged

    xq '.' -x < artifacts/mocha_results_sonar/merged > artifacts/mocha_results_sonar_merged.xml
    xq '.' < artifacts/mocha_results_sonar_merged.xml > artifacts/mocha_results_sonar_merged.json

    ${VERBOSE:-false} && cat artifacts/mocha_results_sonar_merged.xml

    log_it 'merged test results for sonar consumption.  output: artifacts/mocha_results_sonar_merged.xml'

    ## Merge to json
    xq -s '.' artifacts/mocha_results_xunit/*.xml > artifacts/mocha_results_xunit_merged.json
}

show_summary () {
    log_it
    TEST_COUNT="$(jq '[.. | objects | .testcase//empty | .. | objects] | length' < artifacts/mocha_results_xunit_merged.json)"
    log_it "TEST_COUNT=$TEST_COUNT"
    SKIPPED="$(jq '[.. | objects | .testcase//empty | .. | objects | select(has("skipped")) ] | length' < artifacts/mocha_results_xunit_merged.json)"
    log_it "$SKIPPED/$TEST_COUNT tests skipped"
    FAILURES="$(jq '[.. | objects | .testcase//empty | .. | objects | select(has("failure")) ] | length' < artifacts/mocha_results_xunit_merged.json)"
    jq '[.. | objects | .testcase//empty | .. | objects | select(has("failure")) ]' < artifacts/mocha_results_xunit_merged.json > artifacts/mocha_failures.json
    if [ "$FAILURES" -eq 0 ]; then
        log_it "$FAILURES/$TEST_COUNT tests failed"
    else
        log_it "ERROR! $FAILURES/$TEST_COUNT tests failed"
        jq '.' artifacts/mocha_failures.json
        log_it "exit with error code 1 due to $FAILURES failed tests"
        exit 1
    fi
}

########## MAIN BLOCK ##########
initialize
convert_and_merge_xml
show_summary
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] success"
