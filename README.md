# grunt-clouddity

## Overview 

Grunt-based cluster management tool base on OpenStacvk and Docker Swarm. 


## Requirements

* `json2yaml` installed (`npm install -g json2yaml`)
* Node 8.7.x or newer


## Installation

* Clone the repo
* Run `npm install` fron the repo roor directory


## Task reference

Print some information on the images available on the cloud provider.


## Task generic parameters

* `--verbose` Prints debug information
* `--quiet` Avoids printing the command 
* `--os-format=(table|json|yaml)` Outputs in a fiven format 


## Creattion of a stack

```
cd test
grunt exec:compiletemplate --input=./config/template.json --output=/tmp/tmpxxx.yaml && \
grunt exec:createstack --stack_name=test1 --template=/tmp/tmpxxx.yaml
```


## Deletion of a stack

```
grunt exec:deletestack --stack_name=test1 --template=/tmp/tmpxxx.yaml
```


## Information on the cluster

```
grunt exec:listflavors 
grunt exec:listimages  
grunt exec:listservers 
```
 

### Unit Tests

`npm test`


### Creation a of Docker Swarm

```
sudo docker swarm init --advertise-addr 103.6.252.46

ssh -f ubuntu@103.6.252.46 -L 2000:10.0.2.21:22 -N
ssh -p 2000 ubuntu@localhost

sudo docker swarm join \
 --token SWMTKN-1-38vui4cwmmdyhudp91e8eqn5wvoyhf5cq0gdh3o9x3bx6n05f7-716orf09uzl7dq75rkan788bk \
 103.6.252.46:2377


export IMAGE_NAME=httpd:latest
export SERVICE_NAME=httpd
sudo docker service create --replicas 3 --name ${SERVICE_NAME} --publish 80:80 ${IMAGE_NAME} 
sudo docker service ls
sudo docker service ps ${SERVICE_NAME}
sudo docker service inspect ${SERVICE_NAME}
sudo docker service rm ${SERVICE_NAME}
```