#!/bin/bash
# set -x

main_block () {
    echo "[$(date)] start"

    mkdir -p temp

    dbus_test 0
    dbus_test 1
    dbus_test 2
    dbus_test 3
    dbus_test 4
    dbus_test 5
    echo "[$(date)] done"
}

dbus_test () {
    local DBUS_NUM=$1
    echo "[$(date)] running dbus_test $ABLUNIT_TEST_RUNNER_DBUS_NUM"
    export ABLUNIT_TEST_RUNNER_DBUS_NUM=$DBUS_NUM
    time docker/run_tests.sh -d -p proj1,proj2 > "temp/dbuslog_${DBUS_NUM}.log" 2>&1

    echo "last log line: $(tail -1 "temp/dbuslog_${DBUS_NUM}.log")"
    # docker/run_tests.sh -d -p proj1 >/dev/null 2>&1 &
    # winpty ./docker/run_tests.sh -d -p proj1 > "temp/dbus-$1.log" 2>&1 &
    # time ./docker/run_tests.sh -d -p proj1 > "temp/dbus-$1.log" 2>&1 &
    # PID=$!

    # local WAIT_COUNT=0
    # while true; do
    #     sleep 1
    #     # shellcheck disable=SC2009
    #     ps -ef | grep -v 'PPID'
    #     # shellcheck disable=SC2009,SC2126
    #     if ! PROCESS_COUNT=$(ps -ef | grep -v 'PPID' | grep "$PID" | wc -l); then
    #         PROCESS_COUNT=0
    #     fi

    #     if [ "$PROCESS_COUNT" = "0" ]; then
    #         EXIT_CODE=$(wait)
    #         echo "[$(date)] test results are ready (EXIT_CODE=$EXIT_CODE)"
    #         return
    #     fi

    #     WAIT_COUNT=$((WAIT_COUNT + 1))
    #     echo -en "\r\rwaiting for test results... (time=$WAIT_COUNT, PID=$PID, PROCESS_COUNT=$PROCESS_COUNT)"
    #     # LINE_COUNT=$(wc -l < "temp/dbus-$1.log")
    #     # echo -en "\r\rwaiting for test results... (time=$WAIT_COUNT, lines=$(wc -l < "temp/dbus-$1.log")) [$(tail -1 "temp/dbus-$1.log")]"
    # done
    # echo "[$(date)] failed to find test results"
}

########## MAIN BLOCK ##########
main_block
echo "[$(date)] [$0] completed successfully!"
