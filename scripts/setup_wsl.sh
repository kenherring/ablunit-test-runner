#!/bin/bash
set -eou pipefail

if [ -z "${WSL_DISTRO_NAME:-}" ]; then
	echo "this script is meant to run under wsl only"
fi

if [ ! -f /mnt/c/Progress/OpenEdge/progress.cfg ]; then
	echo "\$DLC/progress.cfg not found"
	exit 1
fi

if [ ! -f /mnt/c/Progress/OpenEdge/tty/ablunit.pl ]; then
	echo "\$DLC/tty/ablunit.pl not found"
	exit 1
fi

if [ -d "/psc" ]; then
	echo "/psc directory already exists"
	exit 1
fi

docker rm psc
docker run --name psc progresssoftware/prgs-oedb:12.2.12_ent bash -c "exit 0"
sudo docker cp psc:/psc /psc
docker rm psc

sudo chown -R "$USER:$USER" /psc
cp /mnt/c/Progress/OpenEdge/progress.cfg /psc/dlc/progress.cfg
cp /mnt/c/Progress/OpenEdge/tty/ablunit.pl /psc/dlc/tty/ablunit.pl

echo "be sure to add the DLC=/psc/dlc environment variable!"
