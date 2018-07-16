#!/bin/bash
apt-get update
apt-get -y upgrade
apt-get install -y wget software-properties-common
wget -q https://test.docker.com/ -O /root/install_docker.sh
chmod 755 /root/install_docker.sh
/bin/bash /root/install_docker.sh
docker swarm init --listen-addr 0.0.0.0:2377