FROM node:alpine


RUN apk add --update g++
RUN apk add --update make
RUN apk add --update live-media-utils
RUN apk add --update python
RUN apk add --update curl
RUN apk add --update openssh-client
RUN apk add --update tzdata

RUN cp /usr/share/zoneinfo/Europe/London /etc/localtime

ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN cd /tmp/node_modules && curl -L https://github.com/nayrnet/node-hikvision-api/archive/master.zip -o node-hikvision-api-master.zip && unzip node-hikvision-api-master.zip && mv node-hikvision-api-master node-hikvision-api
RUN mkdir -p /opt/app && cp -a /tmp/node_modules /opt/app/


# Uncomment to copy ssh private key from the ./ssh directory into the image to allow remote commands to ssh out.
#RUN mkdir -p ~/.ssh
#ADD ssh/id_rsa /root/.ssh/id_rsa
#ADD ssh/known_hosts /root/.ssh/known_hosts
#RUN chmod 600 ~/.ssh ~/.ssh/id_rsa ~/.ssh/known_hosts

WORKDIR /opt/app
ADD hiki.js /opt/app
ADD config.yml /opt/app

CMD [ "node", "hiki.js" ]
