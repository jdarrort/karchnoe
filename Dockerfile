FROM timbru31/java-node

RUN mkdir /opt/karch
COPY package.json /opt/karch/
COPY index.js /opt/karch/
COPY static/ /opt/karch/static/
COPY apis/ /opt/karch/apis/
COPY plant/ /opt/karch/plant/

WORKDIR /opt/karch
RUN npm install
# Install graphviz
RUN apt-get update &&  apt-get -y install graphviz

CMD [ "node", "index.js" ]

# docker build -t karchnoe .
# docker run  -d -p 9999:80 -v /opt/ACMS/kamereon-architecture-diagram/:/opt/karch/karch_repo --name karchnoe karchnoe
