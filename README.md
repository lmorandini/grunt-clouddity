# grunt-clouddity

## Overview 

Grunt-based cluster management tool base on OpenStacvk and Docker Swarm. 


## Task reference

Print some information on the images available on the cloud provider.


## Installation


## Task generic paramters

* `--verbose` Prints debug information
* `--quiet` Avoids printing the command 
* `--os-format=(table|json|csv)` Outputs in a fiven format 


## Creattion of a stack

```
grunt exec:compiletemplate --input=./config/template.json --output=/tmp/tmpxxx.yaml
grunt exec:stackcreate --stack_name=test1 --template=/tmp/tmpxxx.yaml
grunt exec:stackdelete --stack_name=test1 --template=/tmp/tmpxxx.yaml
```


## Information on the cluster

```
grunt exec:listflavors 
grunt exec:listimages  
grunt exec:listservers 
```
 

### Unit Tests

`npm test`

