#!/bin/bash
set -eou pipefail

export PATH=$PATH:$DLC/ant/bin

cd test_projects/proj0
ant
