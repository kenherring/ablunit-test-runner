#!/bin/bash
set -eou pipefail

DIRS=(listings .builder build ablunit-output workspaceAblunit)
PATTERNS=("ablunit.json" "ablunit.log" "progress.ini" "prof.out" "prof.json" "protrace.*" "results.json"
			 "results.xml" "dbg_*" "*.r" "*.xref" "results.prof" "profiler.json" "profile.options")


echo "deleting directories..."
rm -rf artifacts/ coverage/
find . -type d -name "kherring.ablunit-test-provider" -exec rm -rf {} + &
if [ "${OS:-}" = "Windows_NT" ]; then
	rm -rf C:/temp/ablunit/ &
else
	rm -rf /tmp/ablunit/ &
fi
for DIR in "${DIRS[@]}"; do
	find test_projects -type d -name "$DIR" -exec rm -rv {} + &
done


echo "deleting file patterns..."
for PATTERN in "${PATTERNS[@]}"; do
	find test_projects -type f -name "$PATTERN" -delete &
done


wait
echo "cleanup complete"
