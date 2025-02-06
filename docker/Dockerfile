ARG OE_VERSION
ARG NODE_VERSION=24
FROM progresssoftware/prgs-oedb:${OE_VERSION}_ent AS psc
FROM node:${NODE_VERSION}

## dependencies for running vscode extension tests
RUN apt-get update \
    && apt-get install -y --no-install-recommends libasound2 libgbm1 libgtk-3-0 libnss3 vulkan-tools \
    && apt-get install -y --no-install-recommends xauth xvfb xauth rsync ant jq dbus \
    && apt-get install -y --no-install-recommends gh pipx \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

## dependencies for running ablunit tests
COPY --from=psc --chown=circleci:circleci --chmod=744 /psc /psc
ADD .rssw/oedoc.bin /root/.rssw/oedoc.bin
RUN if [ ! -f /root/.rssw/oedoc.bin ]; then echo "/root/.rssw/oedoc.bin oedoc.bin not found" && exit 1; fi
ARG PCT_VERSION
ADD https://github.com/Riverside-Software/pct/releases/download/v${PCT_VERSION}/PCT.jar /usr/share/ant/lib/PCT-${PCT_VERSION}.jar
RUN echo "JAVA_HOME=$(which java)" > /psc/dlc/properties/java.properties

ENV JAVA_HOME=/usr
ENV TERM=vt100
ENV DLC=/psc/dlc
ENV PATH=$PATH:$DLC/bin
ENV PROMSGS=$DLC/promsgs

## clone and build ablunit.pl for the OE version
WORKDIR /psc/dlc/tty
ARG OE_VERSION
ENV OE_VERSION=${OE_VERSION}
ENV DOCKER_IMAGE=ablunit-test-runner-${OE_VERSION}
RUN mkdir /home/circleci
ADD build.xml /psc/dlc/tty/build.xml
ADD https://github.com/progress/ADE/archive/refs/tags/v${OE_VERSION}.0.tar.gz /home/circleci/
RUN --mount=type=secret,id=license,target=/psc/dlc/progress.cfg \
    tar -xzf "/home/circleci/v${OE_VERSION}.0.tar.gz" -C . \
    && mv ADE-${OE_VERSION}.0 ADE \
    && ant compile \
    && rm -rf build.xml ADE/ /tmp/*
WORKDIR /

## create directory for vscode-test which will be a mounted volume
RUN mkdir -p ~/.vscode-test

## install xq (via yq) for xml parsing
RUN pipx install yq
ENV PATH=$PATH:/root/.local/bin

WORKDIR /home/circleci/project
