#!/bin/bash
set -euo pipefail

# shellcheck disable=SC3030
DIRS=(listings .builder build ablunit-output workspaceAblunit)
# shellcheck disable=SC3030
PATTERNS=("ablunit.json" "ablunit.log" "progress.ini" "prof.out" "prof.json" "profile.json" "protrace.*" "results.json"
			 "results.xml" "dbg_*" "*.r" "*.restore" "*.xref" "results.prof" "profiler.json" "profile.options")


echo "deleting directories..."
rm -rf artifacts/ coverage/
find . -type d -name "kherring.ablunit-test-runner" -exec rm -rf {} + &
if [ "${OS:-}" = "Windows_NT" ]; then
	rm -rf C:/temp/ablunit/ &
else
	rm -rf /tmp/ablunit/ &
fi
# shellcheck disable=SC3054
for DIR in "${DIRS[@]}"; do
	find test_projects -type d -name "$DIR" -exec rm -rv {} + &
done


echo "deleting file patterns..."
# shellcheck disable=SC3054
for PATTERN in "${PATTERNS[@]}"; do
	find test_projects -type f -name "$PATTERN" -delete &
done

wait
echo "cleanup complete"
