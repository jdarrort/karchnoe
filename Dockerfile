FROM openjdk:latest

RUN apt-get install -y curl \
  && curl -sL https://deb.nodesource.com/setup_10.x | bash - \
  && apt-get install -y nodejs \
  && curl -L https://www.npmjs.com/install.sh | sh \

RUN mkdir /opt
COPY *.* /opt
COPY static/ /opt/static/
COPY apis/ /opt/apis/
COPY plant/ /opt/plant/

WORKDIR /opt
RUN npm install

CMD [ "node", "index.js" ]

