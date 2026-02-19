#!/bin/bash
set -eou pipefail

## create ablunit.pl
PROGRESS_ADE_TAG=$(cat /psc/dlc/version | cut -d ' ' -f3)
## if PROGRESS_ADE_TAG only has two version numbers, add .0 to the end of it
if [[ $(echo "$PROGRESS_ADE_TAG" | grep -o '\.' | wc -l) -eq 1 ]]; then
    PROGRESS_ADE_TAG="${PROGRESS_ADE_TAG}.0"
fi
TEMP_DIR=/tmp/compile_deps/

mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"
[ -f ./docker/compile_deps/ ] && cp ./docker/compile_deps/ "$TEMP_DIR"

if [ ! -f "ADE_${PROGRESS_ADE_TAG}.tar.gz" ]; then
    curl -L -o "ADE_${PROGRESS_ADE_TAG}.tar.gz" "https://github.com/progress/ADE/archive/refs/tags/v${PROGRESS_ADE_TAG}.0.tar.gz"
fi
tar -xzf "ADE_${PROGRESS_ADE_TAG}.tar.gz" -C .
mv "ADE-${PROGRESS_ADE_TAG}.0" ADE
ant compile
cp ./ablunit.pl /psc/dlc/tty/

rm -r "$TEMP_DIR"

if [ -f "$DLC/tty/ablunit.pl" ]; then
    echo "created $DLC/tty/ablunit.pl successfully!"
else
    echo "ERROR: failed to create $DLC/tty/ablunit.pl!"
    exit 1
fi
