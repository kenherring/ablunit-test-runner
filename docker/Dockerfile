FROM cimg/node:20.8

# requirements for running vscode extension tests
RUN sudo apt update \
	&& sudo apt install -y libasound2 libgbm1 libgtk-3-0 libnss3 xvfb \
	&& sudo rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# requirements for running ablunit tests
COPY --from=progresssoftware/prgs-oedb:12.2_latest_ent --chown=circleci:circleci --chmod=744 /psc /psc

RUN sudo chmod a+x /psc/dlc/bin/_progres

ENV DLC /psc/dlc
ENV PATH $PATH:$DLC/bin
ENV PROMSGS $DLC/promsgs
