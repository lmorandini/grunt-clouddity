# grunt-clouddity

## Overview 

Grunt tasks to ease the deployment of application on clusters using Grunt, Docker and PkgCloud.

TODO: add description of Docker steps

The tasks must be run in a certain order, since nodes depends on security groups, and the
actual IP addresses of nodes is known only after the nodes deployment.

Therefore, the usual procedure for deploying a cluster is:
```
grunt clouddity:createsecuritygroups
grunt clouddity:createnodes
grunt clouddity:updatesecuritygroups
```
TODO: add test step

...and the procedure to un-dpeloy is:
```
grunt clouddity:destroynodes
grunt clouddity:destroysecuritygroups
```

To call these tasks in one step, add the following to the Gruntfile:
```
grunt.registerTask("deploy", [ "clouddity:createsecuritygroups", "wait",
      "clouddity:createnodes", "wait", "clouddity:updatesecuritygroups", "wait",
      "clouddity:pull", "wait", "clouddity:run", "wait"]);
grunt.registerTask("undeploy", [ "clouddity:destroynodes", "wait",
      "clouddity:destroysecuritygroups" ]);
```

The "wait" task is necessary to give time to the cloud to complete all operations, and it
is defined as:
(In the dependencies section of package.json)
```"grunt-wait": "^0.1.0"```
(In the Gruntfile)
```
wait : {
          options : {
            // Two minutes
            delay : 120000
          },
          pause : {
            options : {
              before : function(options) {
                console.log("Pausing %ds", options.delay / 1000);
              },
              after : function() {
                console.log("End pause");
              }
            }
          }
        }
...
grunt.loadNpmTasks("grunt-wait");
```


## Tasks

TODO: add test tasks
TODO: add Docker tasks

### clouddity:listnodes

Prints some information about the nodes defined in the Gruntfile that are deployed on the cloud.


### clouddity:listsecuritygroups

Prints some information about the security groups defined in the Gruntfile that are deployed on the cloud.


### clouddity:createsecuritygroups

Creates the security groups defined in the Gruntfile, but without substituting remoteIpNodePrefixes 
with the actual IP addresses.


### clouddity:createnodes

Creates on the cloud the nodes as defined in the Gruntfile.


### clouddity:updatesecuritygroups

Substitutes remoteIpNodePrefixes with the actual IP addresses of the nodes deployed on the cloud.


### clouddity:destroynodes

Deletes the nodes deployed on the cloud.


### clouddity:destroysecuritygroups

Deletes the security groups deployed on the cloud.






