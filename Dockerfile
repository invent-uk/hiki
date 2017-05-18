FROM node:alpine

RUN apk add --update g++
RUN apk add --update make
RUN apk add --update live-media-utils
RUN apk add --update python
RUN apk add --update curl

ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN cd /tmp/node_modules && curl -L https://github.com/nayrnet/node-hikvision-api/archive/master.zip -o node-hikvision-api-master.zip && unzip node-hikvision-api-master.zip && mv node-hikvision-api-master node-hikvision-api
RUN mkdir -p /opt/app && cp -a /tmp/node_modules /opt/app/


WORKDIR /opt/app
ADD hiki.js /opt/app
ADD config.yml /opt/app

CMD [ "node", "hiki.js" ]
