# grunt-clouddity

## Overview 

Grunt tasks to ease the deployment of application on clusters using Grunt, Docker and PkgCloud. These grunt tasks rely on the Gruntfile for configuration (an example can be found under `/test`). 

The general concept is that a cluster is defined in terms of node types and Docker images,
then it is deployed and commands are run against all nodes (or Docker images) of the cluster.

The provisioning tasks (must be run in a certain order, since nodes depends on security groups, and the actual IP addresses of nodes are known only after deployment (IP addresses are necessary to define intra-cluster security groups).

A given order must be observer when building and running Docker containers on the deployed nodes.

NOTE: To identify nodes, each is given an hostname composed by the cluster name and the node type: `<cluster name>-<sequence number>-<node type name>`


### Provisioning

The usual procedure for deploying a cluster is:
```
grunt clouddity:createsecuritygroups
grunt clouddity:createnodes
grunt clouddity:updatesecuritygroups
```
(the last step adds the actual IP addresses to the security group rules if needed)

...and the procedure to un-deploy is:
```
grunt clouddity:destroynodes
grunt clouddity:destroysecuritygroups
```


### Management of Docker images

After Docker images are built and pushed to a Docker registry (grunt-dock can be used for that), Clouddity takes care of pulling the images from all the deployed nodes and creating Docker containers.

Before creating containers, configuration data can be uploaded to the nodes and then referenced by the Docker containers with the `copytohost` task.

The usual sequence of steps is
```
grunt clouddity:copytohost
grunt clouddity:pull
grunt clouddity:run
```

In addition, Docker containers can be stopped, started and removed. The containers are created and started according to the order the images are listed in the node type `images` property.

For debugging purpose, the `verbose` Grunt option could be useful, since it makes Docker prints out more information.


### Testing the cluster

The final step is testing the cluster
`grunt clouddity:test`

For every node types an Array of tests can be performed, with the result of every 
request being tested either for containing a string, or starting with a string.

It could be useful to chain together tasks using the `grunt.registerTask`, but some steps take some time to complete after the control has returned to Grunt, hence they should be separated by "wait" task (grunt-wait may come in handy).

The execution of some tasks (run, create, stop, start, remove) can be performed
selectively only on node type using the `nodetype` switch. In addition, a single container can be targeted using the `containerid` switch, and a node as well with the `nodeid` switch (with the last two options, `nodetype` is ignored).


## Task reference


### clouddity:listnodes

Prints some information about the nodes defined in the Gruntfile that are deployed on the cloud. If the `hosts-format` option is used, the IP addresses and the hostnames are printed out in the format used by `/etc/hosts`.


### clouddity:createnodes

Creates on the cloud the nodes as defined in the Gruntfile.


### clouddity:destroynodes

Deletes the nodes deployed on the cloud.


### clouddity:listsecuritygroups

Prints some information about the security groups defined in the Gruntfile that are deployed on the cloud.


### clouddity:createsecuritygroups

Creates the security groups defined in the Gruntfile, but without substituting remoteIpNodePrefixes 
with the actual IP addresses.


### clouddity:updatesecuritygroups

Substitutes remoteIpNodePrefixes with the actual IP addresses of the nodes deployed on the cloud.


### clouddity:destroysecuritygroups

Deletes the security groups deployed on the cloud.


### clouddity:destroysecuritygroups

Deletes the security groups deployed on the cloud.


### clouddity:copytohost

Copies a series of files or directory from the development machine to the deployed nodes.


### clouddity:addhosts

Adds the cluster IP addresses to each `/etc/hosts` of the nodes (the cluster addresses
take precedence, the existing `/etc/hosts` file being appended to the cluster addresses).


### clouddity:pull

Pulls Docker images from a registry to all nodes in the cluster.


### clouddity:run

Creates and starts Docker containers from the pulled images.


### clouddity:listcontainers

Lists all the containers deployed on the cluster.


### clouddity:start

Starts all Docker containers.


### clouddity:stop

Stops all Docker containers.


### clouddity:remove

Remove all Docker containers.


### clouddity:test

Tests the cluster using HTTP requests.


## Installation


## Target cluster pre-requirements

* All the nodes need to have the Docker demon installed and running
* All the nodes need to have SSH server running and its port open
* The Docker registry of choice must be reachable from all the nodes 


## Development machine pre-requirements

* SSH client installed 
* Grunt installed `sudo npm install -g grunt --save-dev`
* Grunt-cli installed `npm install grunt-cli --save-dev`
* Docker installed and its daemon running on TCP port 2375 
  (add this line to the `/etc/default/docker` file: 
  `DOCKER_OPTS="-H tcp://0.0.0.0:2375 -H unix:///var/run/docker.sock"`
  and restart the Docker daemon (`sudo systemctl daemon-reload`)

NOTE: On Ubuntu 15.04 and Docker 1.8.2, set this line:
`ExecStart=/usr/bin/docker daemon -H tcp://0.0.0.0:2375 -H unix:///var/run/docker.sock` 
in `/etc/systemd/system/docker.service` and restart the Docker daemon
con `sudo systemctl daemon-reload; sudo service docker restart`


## Testing


### Unit Tests

`npm test`

