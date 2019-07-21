
#See Dockerfile.root for jdarrort/java-node-plant image build
FROM jdarrort/java-node-plant

RUN mkdir /opt/karch
COPY package.json /opt/karch/
COPY index.js /opt/karch/
COPY static/ /opt/karch/static/
COPY apis/ /opt/karch/apis/
COPY plant/ /opt/karch/plant/

WORKDIR /opt/karch
RUN npm install

CMD [ "node", "index.js" ]

# docker build -t jdarrort/karchnoe .
# docker run -d -p 9999:80 -v /opt/ACMS/kamereon-architecture-diagram/:/opt/karch/karch_repo --name karchnoe jdarrort/karchnoe
# docker run -d -p 8080:80 -v "/Users/py08053/OneDrive - Alliance/GIT-ACMS/kamereon-architecture-diagram":/opt/karch/karch_repo --name karchnoe jdarrort/karchnoe