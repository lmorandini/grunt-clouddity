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
node config/template.js
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

