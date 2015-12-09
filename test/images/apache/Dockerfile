#
# Creates an HTTPd instance with load-balancing
#
FROM httpd:2.4

ENV APACHE_DIR /usr/local/apache2
ENV APACHE_LOG_DIR /var/log/apache2
ENV APACHE_RUN_USER daemon
ENV APACHE_RUN_GROUP daemon
ENV CONSULKV_HOST oa-loadbalancer
ENV CONSULKV_PORT 8500

RUN apt-get update &&\
    apt-get -y install libapache2-mod-proxy-html &&\
    mkdir ${APACHE_LOG_DIR} &&\
    cp /usr/lib/apache2/modules/mod_proxy_html.so ${APACHE_DIR}/modules &&\
    cp /usr/lib/apache2/modules/mod_slotmem_plain.so ${APACHE_DIR}/modules

COPY httpd.conf ${APACHE_DIR}/conf/
COPY htpasswd "${APACHE_DIR}/conf/htpasswd"
