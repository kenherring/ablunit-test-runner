#!/bin/bash
set -eou pipefail

initialize () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    rm -f artifacts/mocha_results_sonar/merged*.xml
    if ! find artifacts/mocha_results_sonar -type f -name "*.xml"; then
        echo "ERROR: no *.xml files found in artifacts/mocha_results_sonar"
        exit 1
    else
        echo "Directory is empty"
    fi
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

    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] merged test results for sonar consumption.  output: artifacts/mocha_results_sonar_merged.xml"

    ## Merge to json
    xq -s '.' artifacts/mocha_results_xunit/*.xml > artifacts/mocha_results_xunit_merged.json
}

show_summary () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    TEST_COUNT="$(jq '[.. | objects | .testcase//empty | .. | objects] | length' < artifacts/mocha_results_xunit_merged.json)"
    echo "[$(date +%Y-%m-%d:%H:%M:%S) TEST_COUNT=$TEST_COUNT"
    SKIPPED="$(jq '[.. | objects | .testcase//empty | .. | objects | select(has("skipped")) ] | length' < artifacts/mocha_results_xunit_merged.json)"
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $SKIPPED/$TEST_COUNT tests skipped"
    FAILURES="$(jq '[.. | objects | .testcase//empty | .. | objects | select(has("failure")) ] | length' < artifacts/mocha_results_xunit_merged.json)"
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $FAILURES/$TEST_COUNT tests failed"
    jq '[.. | objects | .testcase//empty | .. | objects | select(has("failure")) ]' < artifacts/mocha_results_xunit_merged.json > artifacts/mocha_failures.json
    if [ "$FAILURES" -eq 0 ]; then
        echo "[$(date +%Y-%m-%d:%H:%M:%S) $FAILURES/$TEST_COUNT tests failed"
    else
        echo "[$(date +%Y-%m-%d:%H:%M:%S) ERROR! $FAILURES/$TEST_COUNT tests failed"
        jq '.' artifacts/mocha_failures.json
        echo "[$(date +%Y-%m-%d:%H:%M:%S) exit with error code 1 due to $FAILURES failed tests"
        exit 1
    fi
}

########## MAIN BLOCK ##########
initialize
convert_and_merge_xml
show_summary
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] success"
