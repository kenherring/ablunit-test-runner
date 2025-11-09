#!/bin/bash
set -eou pipefail

## create ablunit.pl
PROGRESS_ADE_TAG=$(cat /psc/dlc/version | cut -d ' ' -f3)
mkdir /tmp/create_ablunit
cp ./docker/build.xml /tmp/create_ablunit/
cd /tmp/create_ablunit
if [ ! -f "ADE_${PROGRESS_ADE_TAG}.tar.gz" ]; then
    curl -L -o "ADE_${PROGRESS_ADE_TAG}.tar.gz" "https://github.com/progress/ADE/archive/refs/tags/v${PROGRESS_ADE_TAG}.0.tar.gz"
fi
tar -xzf "ADE_${PROGRESS_ADE_TAG}.tar.gz" -C .
mv "ADE-${PROGRESS_ADE_TAG}.0" ADE
ant compile
cp ./ablunit.pl /psc/dlc/tty/

rm -r /tmp/create_ablunit


if [ -f "$DLC/tty/ablunit.pl" ]; then
    echo "created $DLC/tty/ablunit.pl successfully!"
else
    echo "ERROR: failed to create $DLC/tty/ablunit.pl!"
    exit 1
fi
