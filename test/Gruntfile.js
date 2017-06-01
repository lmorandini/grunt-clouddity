 "use strict";

module.exports = function(grunt) {

  // Custom config used by Grunt, useful to keep sensitive information
  // such as usernames, passwords,, SSH keys, etc.
  grunt.sensitiveConfig = grunt.file.readJSON("./test/sensitive.json");

  // General configuration of the module (image versions, etc)
  grunt.customConfig = grunt.file.readJSON("./test/custom-configuration.json");

  grunt
      .initConfig({
        // Module information
        pkg : grunt.file.readJSON("package.json"),

        // Docker configuration
        dock : {
          options : {
            auth : grunt.sensitiveConfig.docker.registry.auth,
            registry : grunt.sensitiveConfig.docker.registry.serveraddress,

            // Local docker demon used to send Docker commands to the cluster
            docker : grunt.sensitiveConfig.docker.master,

            // Options for the Docker clients on the servers
            dockerclient : grunt.sensitiveConfig.docker.client,

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
                        Binds : [ "/home/ubuntu/:/hostvolume" ],
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
              }
            }
          }
        },

        clouddity : {
          // PkgCloud client configuration
          pkgcloud : grunt.sensitiveConfig.pkgcloud,

          // Docker client configuratio
          docker : grunt.sensitiveConfig.docker,

          // Name of cluster to build (server names are composed as <cluster
          // name>-<node type increment number>-<node type>, i.e.:
          // "oa-1-computing")
          clusterAliases: grunt.customConfig.clusterAliases[grunt.option("cluster") || "vh"],
 
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

        // External volumes to be attached to the node (see the volumes Array in nodetypes) 
        volumetypes : [ {
          name : "dbdata",
          size : 1,
          description : "CouchDB Data",
          volumeType: grunt.sensitiveConfig.pkgcloud.volume_type,
          availability_zone : grunt.sensitiveConfig.pkgcloud.availability_zone_volume,
          mountpoint: "/hostvolume",
          fstype: "ext4"
        } ],

          // Types of node to provision (the images property contains the images
          // that are to be deployed on each node type. Replication is the
          // number of nodes of the same type to provision
          nodetypes : [
              {
                name : "computing",
                replication : 3,
                imageRef : "81f6b78f-6d51-4de9-a464-91d47543d4ba",
                flavorRef : "885227de-b7ee-42af-a209-2f1ff59bc330",
                securitygroups : [ "default", "dockerd" ],
                images : [ "apache" ],
                volumes : [ "dbdata" ]
              },
              {
                name : "loadbalancer",
                replication : 1,
                imageRef : "81f6b78f-6d51-4de9-a464-91d47543d4ba",
                flavorRef : "885227de-b7ee-42af-a209-2f1ff59bc330",
                securitygroups : [ "default", "dockerd", "http" ],
                copytohost : [ {
                  from : "./target/nodetypes/loadbalancer",
                  to : "/home/ubuntu/loadbalancer"
                } ],
                images : [ "apache", "consul" ],
                // Test cases to execute to check the deployment success
                test : [
                    {
                      name : "GetCapabilities",
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
                      name : "GetFeature",
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
                      name : "GetCapabilitiesWPS",
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
                      name : "GetCapabilitiesCSW",
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
                      name : "dataregistry",
                      auth : grunt.sensitiveConfig.test.auth,
                      protocol : "http",
                      port : 80,
                      path : "/reg/dataregistry/url",
                      query : {},
                      shouldStartWith : "[{\"CreateIndex"
                    } ]

              } ]
        }
      });

  grunt.loadTasks("./tasks");
};
