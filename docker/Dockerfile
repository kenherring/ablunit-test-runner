FROM node:20.8

# requirements for running vscode extension tests
RUN apt update \
	&& apt install -y libasound2 libgbm1 libgtk-3-0 libnss3 \
	&& apt install -y xvfb rsync \
	&& rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# requirements for running ablunit tests
ADD docker/ablunit.pl /psc/dlc/tty/ablunit.pl
COPY --from=progresssoftware/prgs-oedb:12.2_latest_ent --chown=circleci:circleci --chmod=744 /psc /psc
ENV DLC /psc/dlc
ENV PATH $PATH:$DLC/bin
ENV PROMSGS $DLC/promsgs
ENV TERM=vt100

# create directory for vscode-test which will be a mounted volume
RUN mkdir -p ~/.vscode-test
