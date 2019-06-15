FROM timbru31/java-node

RUN mkdir /opt/karch
COPY *.* /opt/karch/
COPY static/ /opt/karch/static/
COPY apis/ /opt/karch/apis/
COPY plant/ /opt/karch/plant/

WORKDIR /opt/karch
RUN npm install

CMD [ "node", "index.js" ]

# docker build -t karchnoe .
# docker run  -d -p 9999:80 -t karchnoe -v /opt/ACMS/kamereon-architecture-diagram/:/opt/karch/karch_repo --name karchnoe karchnoe
