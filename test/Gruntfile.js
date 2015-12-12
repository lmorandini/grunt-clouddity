"use strict";

module.exports = function(grunt) {

  // Custom config used by Grunt, useful to keep sensitive information
  // such as credentials
  grunt.sensitiveConfig = grunt.file.readJSON("./sensitive.json");

  // General configuration of the module (image versions, etc)
  grunt.customConfig = grunt.file.readJSON("./custom-configuration.json");

  grunt
      .initConfig({
        // Module information
        pkg : grunt.file.readJSON("./../package.json"),
        clouddity : {
          // PkgCloud configuration
          pkgcloud : grunt.sensitiveConfig.pkgcloud.client,

          // Docker configuration
          docker : grunt.sensitiveConfig.docker,

          // Name of cluster to build (server names are composed as <cluster
          // name>-<node type increment number>-<node type>, i.e.:
          // "oa-1-computing")
          cluster : "oa",

          // Security groups as defined by PkgCloud
          securitygroups : {
            dockerd : {
              description : "Open the Docker demon port to dev machines",
              rules : [ {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 2375,
                portRangeMax : 2375,
                remoteIpPrefix : grunt.sensitiveConfig.devIPs
              } ]
            },
            http : {
              description : "Open two HTTP ports to the load-balancer, computing, and dev machines",
              rules : [ {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 80,
                portRangeMax : 81,
                remoteIpPrefix : grunt.sensitiveConfig.devIPs,
                remoteIpNodePrefixes : [ "loadbalancer", "computing" ]
              } ]
            }
          },

          // Types of node to provision
          nodetypes : [ {
            name : "computing",
            replication : 3,
            imageRef : "81f6b78f-6d51-4de9-a464-91d47543d4ba",
            flavorRef : "885227de-b7ee-42af-a209-2f1ff59bc330",
            securitygroups : [ "default", "dockerd" ],
            images : [ "apache" ]
          }, {
            name : "loadbalancer",
            replication : 1,
            imageRef : "81f6b78f-6d51-4de9-a464-91d47543d4ba",
            flavorRef : "885227de-b7ee-42af-a209-2f1ff59bc330",
            securitygroups : [ "default", "dockerd", "http" ],
            images : [ "apache", "consul" ]
          } ],

          // Docker images to deploy to nodes
          images : {
            apache : {
              dockerfile : "./apache",
              tag : "2.4",
              repo : "apache",
              options : {
                build : {
                  t : grunt.sensitiveConfig.docker.registry.serveraddress
                      + "/apache:2.4",
                  pull : true,
                  nocache : true
                },
                run : {
                  create : {
                    ExposedPorts : {
                      "80/tcp" : {}
                    },
                    HostConfig : {
                      PortBindings : {
                        "80/tcp" : [ {
                          HostPort : "80"
                        } ]
                      }
                    }
                  },
                  start : {},
                  cmd : []
                }
              }
            },
            consul : {
              dockerfile : "./consul",
              tag : "0.3.1",
              repo : "consul",
              options : {
                build : {
                  t : grunt.sensitiveConfig.docker.registry.serveraddress
                      + "/consul:0.3.1",
                  pull : true,
                  nocache : true
                },
                run : {
                  create : {
                    ExposedPorts : {
                      "8500/tcp" : {}
                    },
                    HostConfig : {
                      PortBindings : {
                        "8500/tcp" : [ {
                          HostPort : "8500"
                        } ]
                      }
                    }
                  },
                  start : {},
                  cmd : []
                }
              }
            },

            // Test cases to execute to check the deployment success
            test : [
                {
                  auth : grunt.sensitiveConfig.test.auth,
                  protocol : "http",
                  port : 80,
                  path : "/wfs",
                  query : {
                    request : "GetCapabilities",
                    version : "1.1.0",
                    service : "wfs"
                  },
                  shouldStartWith : "<ows:"
                },
                {
                  auth : grunt.sensitiveConfig.test.auth,
                  protocol : "http",
                  port : 80,
                  path : "/wfs",
                  query : {
                    request : "GetFeature",
                    version : "1.1.0",
                    service : "wfs",
                    typename : "aurin:evi_AusByEVI2011_DataProfile",
                    maxfeatures : "2"
                  },
                  shouldStartWith : "<?xml version=\"1.0\" encoding=\"UTF-8\"?><wfs:FeatureCollection"
                },
                {
                  auth : grunt.sensitiveConfig.test.auth,
                  protocol : "http",
                  port : 80,
                  path : "/wps",
                  query : {
                    request : "GetCapabilities",
                    version : "1.0.0",
                    service : "wps"
                  },
                  shouldStartWith : "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                },
                {
                  auth : grunt.sensitiveConfig.test.auth,
                  protocol : "http",
                  port : 80,
                  path : "/csw",
                  query : {
                    request : "GetCapabilities",
                    version : "2.0.2",
                    service : "csw"
                  },
                  shouldStartWith : "<?xml version=\"1.0\" encoding=\"UTF-8\"?><csw:Capabilities xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:gmd=\"http://www.isotc211.org/2005/gmd\" xmlns:xs=\"http://www.w3.org/2001/XMLSchema\" xmlns:ogc=\"http://www.opengis.net/ogc\" xmlns:gml=\"http://www.opengis.net/gml\" xmlns:ows=\"http://www.opengis.net/ows\" xmlns:csw=\"http://www.opengis.net/cat/csw/2.0.2\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" version=\"2.0.2\" xsi:schemaLocation=\"http://www.opengis.net/cat/csw/2.0.2 http://schemas.opengis.net/csw/2.0.2/CSW-discovery.xsd\"><ows:ServiceIdentification><ows:ServiceType>CSW"
                }, {
                  auth : grunt.sensitiveConfig.test.auth,
                  protocol : "http",
                  port : 80,
                  path : "/reg/dataregistry/url",
                  query : {},
                  shouldStartWith : "[{\"CreateIndex"
                } ]
          }
        }
      });

  // Dependent tasks declarations
  require("load-grunt-tasks")(grunt, {
    config : "../package.json",
    pattern : [ "../grunt-*", "../@*/grunt-*" ]
  });

  grunt.loadTasks("../tasks");

  /*
   * // Setups and builds the Docker images grunt.registerTask("build", [
   * "copy", "ejs", "dock:build" ]); // Pushes the Docker images to registry
   * grunt.registerTask("push", [ "dock:push" ]); // Pulls the Docker images
   * from registry to the servers grunt.registerTask("pull", [ "openapi:pull"
   * ]); // Removes the running containers grunt.registerTask("remove", [
   * "openapi:remove" ]); // Runs the Docker images from registry to the servers
   * grunt.registerTask("run", [ "openapi:run" ]); // Tests the running
   * containers grunt.registerTask("test", [ "openapi:test" ]); // Deploys and
   * un-deploys the entire OpenAPI infrastructure grunt.registerTask("deploy", [
   * "openapi:createsecuritygroups", "wait", "openapi:createservers", "wait",
   * "openapi:updatesecuritygroups", "wait", "openapi:pull", "wait",
   * "openapi:run", "wait", "openapi:test" ]); grunt.registerTask("undeploy", [
   * "openapi:destroyservers", "wait", "openapi:destroysecuritygroups" ]); //
   * Builds images and pushes/pulls them grunt.registerTask("redeployimages", [
   * "build", "push", "pull" ]); // Re-deploys the containers
   * grunt.registerTask("redeploy", [ "remove", "wait", "run", "wait", "test"
   * ]);
   */
};
