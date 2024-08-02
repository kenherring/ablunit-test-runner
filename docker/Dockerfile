ARG OE_VERSION
FROM progresssoftware/prgs-oedb:${OE_VERSION}_ent AS psc
FROM node:20.8

## dependencies for running vscode extension tests
RUN apt-get update \
    && apt-get install -y --no-install-recommends libasound2 libgbm1 libgtk-3-0 libnss3 vulkan-tools \
    && apt-get install -y --no-install-recommends xauth xvfb xauth rsync ant jq dbus \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

## dependencies for running ablunit tests
COPY --from=psc --chown=circleci:circleci --chmod=744 /psc /psc
ADD .rssw/oedoc.bin /root/.rssw/oedoc.bin

RUN if [ ! -f /root/.rssw/oedoc.bin ]; then echo "/root/.rssw/oedoc.bin oedoc.bin not found" && exit 1; fi
RUN curl -v -L https://github.com/Riverside-Software/pct/releases/download/v228/PCT.jar -o /usr/share/ant/lib/PCT.jar
RUN echo "JAVA_HOME=$(which java)" > /psc/dlc/properties/java.properties

ENV JAVA_HOME=/usr
ENV TERM=vt100
ENV DLC=/psc/dlc
ENV PATH=$PATH:$DLC/bin
ENV PROMSGS=$DLC/promsgs

## clone and build ablunit.pl for the OE version
ADD build.xml /psc/dlc/tty/build.xml
WORKDIR /psc/dlc/tty
ARG OE_VERSION
ENV OE_VERSION=${OE_VERSION}
ENV DOCKER_IMAGE=ablunit-test-runner-${OE_VERSION}
RUN --mount=type=secret,id=license,target=/psc/dlc/progress.cfg \
    echo "OE_VERSION=$OE_VERSION}" && \
    git clone --single-branch -b "v${OE_VERSION}.0" https://github.com/progress/ADE.git \
    && ant compile \
    && rm -rf build.xml ADE/ /tmp/*
RUN mkdir /home/circleci
RUN curl -L "https://github.com/progress/ADE/archive/refs/tags/v${OE_VERSION}.0.tar.gz" -o "/home/circleci/v${OE_VERSION}.0.tar.gz"
WORKDIR /

## create directory for vscode-test which will be a mounted volume
RUN mkdir -p ~/.vscode-test

## install vscode packaging dependency
RUN npm install -g @vscode/vsce
RUN npm install -g typescript

WORKDIR /home/circleci/project
