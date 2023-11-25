FROM node:20.8

# requirements for running vscode extension tests
RUN apt update \
	&& apt install -y --no-install-recommends libasound2 libgbm1 libgtk-3-0 libnss3 \
	&& apt install -y --no-install-recommends xauth \
	&& apt install -y --no-install-recommends xvfb rsync \
	&& apt install -y --no-install-recommends ant shellcheck \
	&& rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# requirements for running ablunit tests
ADD docker/ablunit.pl /psc/dlc/tty/ablunit.pl
COPY --from=progresssoftware/prgs-oedb:12.2_latest_ent --chown=circleci:circleci --chmod=744 /psc /psc
RUN curl -v -L https://github.com/Riverside-Software/pct/releases/download/v226/PCT.jar -o /usr/share/ant/lib/PCT.jar
RUN echo "JAVA_HOME=$(which java)" > /psc/dlc/properties/java.properties

ENV DLC /psc/dlc
ENV PATH $PATH:$DLC/bin
ENV PROMSGS $DLC/promsgs
ENV TERM=vt100

# create directory for vscode-test which will be a mounted volume
RUN mkdir -p ~/.vscode-test
