# grunt-clouddity

## Overview 

Grunt tasks to ease the deployment of application on clusters using Grunt, Docker and PkgCloud. These grunt tasks rely on the Gruntfile for configuration (an example can be found under `/test`). 

The general concept is that a cluster is defined in terms of node types and Docker images,
then it is deployed and commands are run against all nodes (or Docker images) of the cluster.

The provisioning tasks (must be run in a certain order, since nodes depends on security groups, and the actual IP addresses of nodes are known only after deployment (IP addresses are necessary to define intra-cluster security groups).

A given order must be observer when building and running Docker containers on the deployed nodes.

NOTE: To identify nodes, each is given an hostname composed by the cluster name and the node type: `<cluster name>-<sequence number>-<node type name>`

NOTE: to access VMs that are hidden behind a firewall, SSH tunnels can be used to operate on the cluster.

The first step is destroy existing SSG tunnels (if any), and create new ones, as in>
```
ps aux | grep "admin@vhprod" | sed -e "s/\s/|/g" | cut -f 2 -d'|' | xargs -i kill {}
ssh -f admin@vhprod-1-loadbalancer -L 2377:vh-1-apiserver:2375 -N
ssh -f admin@vhprod-1-loadbalancer -L 2277:vh-1-apiserver:22 -N
```
There need to be two ports open (SSH and Docker API), and the hostnames (vh-1-apiserver, vh-2-apiserver) are 
the ones on the VMs network (the network vhprod-1-loadbalancer -acting as gateway- sits). 

The second step is to add a `clusterAliases` property to the Gruntfile, defining the VMs of every cluster hidden behind a firewall:
```
  "clusterAliases" : {
    "vhprod" : {
      "ssh" : {
        "username" : "admin",
        "privateKeyFile" : "~/.ssh/id_rsa_admin"
      },
      "nodes" : [ {
        "id" : "vhprod-1-loadbalancer-1",
        "name" : "vhprod-1-loadbalancer",
        "hostId" : "vhprod-1-loadbalancer-1",
        "addresses" : {
          "public" : [ "localhost" ],
          "private" : [],
          "dockerPort" : 2376,
          "sshPort" : 2276
        }
      }, {
        "id" : "vhprod-1-apiserver-2",
        "name" : "vhprod-1-apiserver",
        "hostId" : "vhprod-1-apiserver-2",
        "addresses" : {
          "public" : [ "localhost" ],
          "private" : [],
          "dockerPort" : 2377,
          "sshPort" : 2277
        }
      }]
    }
```
From now on, by specifying the `cluster` Grunt option and setting it to `vhprod`, the SSH tunnels will be used to manage the VMs behind the firewall. 

To add some more run-time flexibility, EJS templates (http://ejs.co/) can be used in the options of Clouddity commands in the Gruntfile. 
The object which is passed to the template containes data about the current node being processed, more specifically:
```
"clouddityRuntime": {
    "node": {
      "node": {
        "id": "74e6b162-7047-4f3d-bcc7-dd018325cbd9",
        "name": "ccdev-1-couchdbc",
        "address": "115.146.94.3",
        "type": "couchdbc"
      },
      "images": ["couchdbc"],
      "ssh": {
        "host": "115.146.94.3",
        "port": 22,
        "username": "ubuntu",
        "privateKeyFile": "/home/lmorandini/.ssh/id_rsa"
      },
      "docker": {
        "protocol": "http",
        "host": "115.146.94.3",
        "port": 2375,
        "auth": "username:password"
      }
    }
  }
  ```

For instance, the actual node IP address can be passed when creating Docker containers by inserting this fragment in the Gruntfile:
```

```

### initial setup of VMs

In sensitive.json there is a user_data property that contains, encoded in base64, the instructions to setup Docker (on the non-default 3375 port) and secure it via HaProxy (on the usual 2375 port):
(The password is sha-512, encoded with `mkpasswd -m sha-512 <password>` .)
```
#!/bin/sh
set -x
echo "post-installation started..."
sudo rm -f /var/lib/dpkg/lock
sudo apt-get update

sudo apt-get install haproxy -y
HAPCFG=/etc/haproxy/haproxy.cfg
echo 'userlist UsersFor_Ops' | sudo tee --append ${HAPCFG}
echo '   group AdminGroup users docker' | sudo tee --append ${HAPCFG}
echo '   user docker password $6$JrosxjE0xDL.a6F3$gR5nHOpi7bAsaTmNXMdGHR/o/rfCAMyU01/p8kNxSnC0jB0b/3JXB5BZETlFZdRUP4AFQ6Ny0zYlQKeXgk3tq.'  | sudo tee --append ${HAPCFG}
echo 'frontend http' | sudo tee --append ${HAPCFG} 
echo '   bind 0.0.0.0:2375' | sudo tee --append ${HAPCFG}
echo '   use_backend docker' | sudo tee --append ${HAPCFG}
echo 'backend docker' | sudo tee --append ${HAPCFG} 
echo '   server localhost localhost:3375'  | sudo tee --append ${HAPCFG} 
echo '   acl AuthOkay_Ops http_auth(UsersFor_Ops)'  | sudo tee --append ${HAPCFG}
echo '   http-request auth realm MyAuthRealm if !AuthOkay_Ops'  | sudo tee --append ${HAPCFG}
sudo service haproxy restart

sudo apt-get install docker.io -y -f
sudo usermod -aG docker ubuntu
echo  'DOCKER_OPTS="-H tcp://0.0.0.0:3375 -H unix:///var/run/docker.sock --insecure-registry cuttlefish.eresearch.unimelb.edu.au --insecure-registry docker.eresearch.unimelb.edu.au --log-opt max-size=10m --log-opt max-file=3"' | sudo tee --append /etc/default/docker
sudo openssl s_client -showcerts -connect docker.eresearch.unimelb.edu.au:443 < /dev/null 2> /dev/null | openssl x509 -outform PEM > eresearch.crt
sudo cp eresearch.crt /usr/local/share/ca-certificates
sudo update-ca-certificates
sudo service docker restart
sudo docker ps
sudo sed -i 's/.*127.0.1.1/#&/' /etc/hosts
echo "post-installation done"
``` 

 
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

The execution of the `createnodes` task can be performed selectively only on a node type using the `nodetype` switch.

The execution of some Dpcker tasks (`run`, `create`, `stop`, `start`, `remove`) can be performed
selectively only on a node type using the `nodetype` switch. In addition, a single container can be targeted using the `containerid` switch, and a node as well with the `nodeid` switch (with the last two options, `nodetype` is ignored).


### Gruntfile examples 

XXX TODO
See in the tests directory


## Task reference


### clouddity:listimages

Print some information on the images available on the cloud provider.


### clouddity:listflavors

Print some information on the flavors of the images available on the cloud provider.


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


### clouddity:exec

Execute a command on deployed containers (the command is taken from the Grunt `command` options), as in:

`grunt clouddity:exec --containerid <container id> --command "/load-data.sh"`

(Usually the `nodetype` option is added, since commands are image-specific.)


### clouddity:logs

Returns the logs of a given container:

`grunt clouddity:logs --containerid <container id> `


### clouddity:execnodes

Execute a command on deployed nodes (not containers as exec) the command is taken from the Grunt `command` options), as in:

`grunt clouddity:execnodes --nodetype db --command "echo 'ok' > /home/ubuntu/a.txt"`

(Usually the `nodetype` option is added, but `nodeid` could be used as well)


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

Mocha needs to be installed globally to run the tests (`npm install -g mocha `).
 

### Unit Tests

`npm test`

