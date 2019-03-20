
# LoopBack App Base Image
# Installs StrongLoop and Git
FROM dockerfile/nodejs

#Installing Loopback
RUN npm install -g strongloop

# Installing Git
RUN mkdir /data/git-tmp
WORKDIR /data/git-tmp
RUN apt-get update
		sudo apt-get install build-essential libssl-dev libcurl4-gnutls-dev libexpat1-dev gettext unzip && \
		wget https://github.com/git/git/archive/v1.9.4.tar.gz && \
		cd git-1.9.4 && \
		make prefix=/usr/local all && \
		sudo make prefix=/usr/local instal && \
		rm /data/git-tmp -Rvf

# Setup Git
RUN git config --global user.name "Tomnuyts1" && \
		git config --global user.email "r0661550@student.thomasmore.be"

CMD ["/bin/bash", "--login"]


# python
FROM python:3

RUN pip install pandas
RUN pip install scipy
RUN pip install sklearn
RUN pip install fuzzywuzzy