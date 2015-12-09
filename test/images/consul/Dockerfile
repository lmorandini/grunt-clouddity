FROM ubuntu

ENV CONSULKV_PORT 8500
ENV consulVersion 0.3.1

RUN apt-get -y update &&\
    apt-get -y install unzip &&\
    apt-get -y install curl
ADD https://dl.bintray.com/mitchellh/consul/${consulVersion}_linux_amd64.zip /tmp/consul.zip
RUN cd /usr/local/sbin && unzip /tmp/consul.zip
COPY ./load.sh /usr/local/load.sh
RUN chmod a+x /usr/local/load.sh

CMD /usr/local/load.sh & \
  /usr/local/sbin/consul agent -bootstrap -server -data-dir=/tmp/consul -client=0.0.0.0
EXPOSE 8400 ${CONSULKV_PORT} 8600/udp