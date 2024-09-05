#!/bin/bash
set -eou pipefail

OE_VERSION=${OE_VERSION:-12.8.1}

if [ -z "${WSL_DISTRO_NAME:-}" ]; then
	echo "this script is meant to run under wsl only"
fi

if [ ! -f /mnt/c/Progress/OpenEdge/progress.cfg ]; then
	echo "/mnt/c/Progress/OpenEdge/progress.cfg not found"
	exit 1
fi

## TODO build this instead of copying it

if [ -d "/psc/dlc-$OE_VERSION" ]; then
	echo "/psc/dlc-$OE_VERSION directory already exists"
	exit 1
fi

docker run --name psc "progresssoftware/prgs-oedb:${OE_VERSION}_ent" bash -c "exit 0"
sudo docker cp psc:/psc/dlc "/psc/dlc-${OE_VERSION}"
docker rm psc

sudo chown -R "$USER:$USER" /psc
cp /mnt/c/Progress/OpenEdge/progress.cfg /psc/dlc/progress.cfg

echo "Be sure to set or change the DLC environment variable (DLC=/psc/dlc-$OE_VERSION)"
