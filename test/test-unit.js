var grunt = require("grunt");
var gruntFile = require("./Gruntfile.js")(grunt);
var customConfig = require("./custom-configuration.json");
var options = grunt.config().clouddity;
var expect = require("chai").expect;
var SandboxedModule = require("sandboxed-module");
var _= require("underscore");

// TODO: a mock Docker should be added to test the iterateOverClusterContainers
// function

// Test data
var servers = require("./data/servers.json");
var securitygroups = require("./data/securitygroups.json");
var iterateOverNodes = require("./data/iterateOverNodes.json");
var iterateOverClusterImages = require("./data/iterateOverClusterImages.json");

var utils = SandboxedModule.require("../lib/utils.js", {
  requires : {
    pkgcloud : {
      compute : {
        createClient : function() {
          return {
            getServers : function(options, callback) {
              return callback(null, servers);
            }
          }
        }
      },
      network : {
        createClient : function() {
          return {
            getSecurityGroups : function(callback) {
              return callback(null, securitygroups);
            }
          }
        }
      }
    }
  },
  globals : [],
  locals : {}
});

describe(
    "clouddity",
    function() {

      describe("naming functions", function() {
        it("should return node type", function(done) {
          expect(utils.nodeType("oa-1-computing")).equal("computing");
          done();
        });
        it("should return node cluster", function(done) {
          expect(utils.nodeCluster("oa-1-computing")).equal("oa");
          done();
        });
        it("should cimpose node name", function(done) {
          expect(utils.nodeName("oa", "computing", 1)).equal("oa-1-computing");
          done();
        });
        it("should cimpose security group name", function(done) {
          expect(utils.securitygroupName("oa", "http")).equal("oa-http");
          done();
        });
        it("should return security group cluster", function(done) {
          expect(utils.securitygroupCluster("oa-http")).equal("oa");
          done();
        });
        it("should return security group minus the cluster name",
            function(done) {
              expect(utils.securitygroupPlainName("oa-http")).equal("http");
              done();
            });
      });

      describe(
          "selective processing function",
          function() {
            it("should allow processing of this container", function(done) {
              grunt.option = function(s) {
                if (s === "nodetype") {
                  return "computing";
                } else {
                  if (s === "nodeid") {
                    return undefined;
                  } else {
                    return "123";
                  }
                  if (s === "containerid") {
                    return undefined;
                  } else {
                    return "456";
                  }
                }
              };
              expect(
                  utils.isContainerToBeProcessed(grunt, "computing", "abc",
                      "apache", null)).equal(true);
              done();
            });
            it("should not allow processing of this container #1", function(
                done) {
              grunt.option = function(s) {
                if (s === "nodetype") {
                  return "computing";
                } else {
                  if (s === "nodeid") {
                    return undefined;
                  } else {
                    return "123";
                  }
                  if (s === "containerid") {
                    return undefined;
                  } else {
                    return "456";
                  }
                }
              };
              expect(
                  utils.isContainerToBeProcessed(grunt, "loadbalancer", "abc",
                      "apache", null)).equal(false);
              done();
            });
            it("should not allow processing of this container #2", function(
                done) {
              expect(
                  utils.isContainerToBeProcessed(grunt, "computing", "abc",
                      "consul", null)).equal(false);
              done();
            });
            it("should allow processing of this container #3", function(done) {
              grunt.option = function() {
                return "loadbalancer";
              };
              expect(
                  utils.isContainerToBeProcessed(grunt, "computing", "abc",
                      "apache", null)).equal(false);
              done();
            });
            it(
                "should allow processing of this container when the typename option is not defined #2",
                function(done) {
                  grunt.option = function() {
                    return undefined;
                  };
                  expect(
                      utils.isContainerToBeProcessed(grunt, "computing", "abc",
                          "apache", null)).equal(true);
                  done();
                });

            it(
                "should allow processing of this container when the container id the one given #1",
                function(done) {
                  grunt.option = function(s) {
                    if (s === "nodetype") {
                      return undefined;
                    } else {
                      return "123";
                    }
                  };
                  expect(
                      utils.isContainerToBeProcessed(grunt, "computing", "abc",
                          "apache", "123")).equal(true);
                  done();
                });

            it(
                "should allow processing of this container when the container id the one given #2",
                function(done) {
                  grunt.option = function(s) {
                    if (s === "nodetype") {
                      return undefined;
                    } else {
                      return "123";
                    }
                  };
                  expect(
                      utils.isContainerToBeProcessed(grunt, "computing", "abc",
                          "apache", "123")).equal(true);
                  done();
                });

            it(
                "should not allow processing of this container when the container id is not the one given",
                function(done) {
                  grunt.option = function(s) {
                    if (s === "nodetype") {
                      return undefined;
                    } else {
                      return "456";
                    }
                  };
                  expect(
                      utils.isContainerToBeProcessed(grunt, "computing", "abc",
                          "apache", "123")).equal(false);
                  done();
                });

            it(
                "should allow processing of this container when the node id the one given #1",
                function(done) {
                  grunt.option = function(s) {
                    if (s === "nodetype") {
                      return undefined;
                    } else {
                      if (s === "containerid") {
                        return undefined;
                      } else {
                        return "abc";
                      }
                    }
                  };
                  expect(
                      utils.isContainerToBeProcessed(grunt, "computing", "abc",
                          "apache", "123")).equal(true);
                  done();
                });

            it(
                "should allow processing of this container when the node id the one given #2",
                function(done) {
                  grunt.option = function(s) {
                    if (s === "nodetype") {
                      return undefined;
                    } else {
                      if (s === "containerid") {
                        return "123";
                      } else {
                        return "abc";
                      }
                    }
                  };
                  expect(
                      utils.isContainerToBeProcessed(grunt, "computing", "abc",
                          "apache", "123")).equal(true);
                  done();
                });

            it(
                "should not allow processing of this container when the node id is not the one given",
                function(done) {
                  grunt.option = function(s) {
                    if (s === "nodetype") {
                      return undefined;
                    } else {
                      if (s === "containerid") {
                        return undefined;
                      } else {
                        return "def";
                      }
                    }
                  };
                  expect(
                      utils.isContainerToBeProcessed(grunt, "computing", "abc",
                          "apache", "123")).equal(false);
                  done();
                });
          });

      describe(
          "selective node processing function",
          function() {
            it("should allow processing of this node", function(done) {
              grunt.option = function(s) {
                if (s === "nodetype") {
                  return "computing";
                } else {
                  return "abc";
                }
              };
              expect(
                  utils.isNodeToBeProcessed(grunt, "computing", "abc")).equal(true);
              done();
            });
            it("should not allow processing of this node", function(
                done) {
              grunt.option = function(s) {
                if (s === "nodetype") {
                  return "computing";
                } else {
                  return "abc";
                }
              };
              expect(
                  utils.isNodeToBeProcessed(grunt, "loadbalancer", "abc")).equal(true);
              done();
            });
            it(
                "should allow processing of this node when the typename option is not defined #1",
                function(done) {
                  grunt.option = function() {
                    return undefined;
                  };
                  expect(
                      utils.isNodeToBeProcessed(grunt, "computing", "abc")).equal(true);
                  done();
                });

            it(
                "should allow processing of this node when the node id the one given #1",
                function(done) {
                  grunt.option = function(s) {
                    if (s === "nodetype") {
                      return undefined;
                    } else {
                      return "abc";
                    }
                  };
                  expect(
                      utils.isNodeToBeProcessed(grunt, "computing", "abc")).equal(true);
                  done();
                });

            it(
                "should not allow processing of this node when the node id is not the one given",
                function(done) {
                  grunt.option = function(s) {
                    if (s === "nodetype") {
                      return undefined;
                    } else {
                      return "cde";
                    }
                  };
                  expect(
                      utils.isContainerToBeProcessed(grunt, "computing", "abc")).equal(false);
                  done();
                });

          });
      
      describe("iterateOverNodes", function() {

        it("should return node data of selected nodes", function(done) {
          var expDataIndex = 0;
          utils.iterateOverNodes(options, function(node) {
            [ "oa-1-computing", "oa-2-computing", "oa-1-loadbalancer" ]
                .indexOf(utils.nodeName) >= 0
          }, function(data, cb) {
            expect(JSON.parse(JSON.stringify(data))).eql(
                JSON.parse(JSON.stringify(iterateOverNodes[expDataIndex])));
            expDataIndex++;
            cb();
          }, function(err) {
            expect(err).equal(null);
            done();
          });
        });

        it("should return node data of all nodes of the cluster",
            function(done) {
              var expDataIndex = 3;
              var expData = [ "oa-1-computing", "oa-2-computing",
                  "oa-3-computing", "oa-1-loadbalancer" ];
              utils.iterateOverNodes(options, function(node) {
                return utils.nodeCluster(node.name) === options.cluster
              }, function(data, cb) {
                expect(data.node.name).equal(expData[expDataIndex]);
                expDataIndex--;
                cb();
              }, function(err) {
                expect(err).equal(null);
                done();
              });
            });

        it("should return node data of all nodes of the cluster #2", function(
            done) {
          var expDataIndex = 3;
          var expData = [ "oa-1-computing", "oa-2-computing", "oa-3-computing",
              "oa-1-loadbalancer" ];
          utils.iterateOverClusterNodes(options, function(data, cb) {
            expect(data.node.name).equal(expData[expDataIndex]);
            expDataIndex--;
            cb();
          }, function(err) {
            expect(err).equal(null);
            done();
          });
        });
      });

      describe(
          "iterateOverSecurityGroups",
          function() {

            it(
                "should return node data of all security groups of the cluster",
                function(done) {
                  var expDataIndex = 0;
                  var expData = [ "oa-consul", "oa-dockerd", "oa-http",
                      "oa-httplb" ];
                  utils
                      .iterateOverSecurityGroups(
                          options,
                          function(sec) {
                            return utils.securitygroupCluster(sec.name) === options.cluster
                          }, function(data, cb) {
                            expect(data.name).equal(expData[expDataIndex]);
                            expDataIndex++;
                            cb();
                          }, function(err) {
                            expect(err).equal(null);
                            done();
                          });
                });

            it(
                "should return node data of all security groups of the cluster #2",
                function(done) {
                  var expDataIndex = 0;
                  var expData = [ "oa-consul", "oa-dockerd", "oa-http",
                      "oa-httplb" ];
                  utils.iterateOverClusterSecurityGroups(options, function(
                      data, cb) {
                    expect(data.name).equal(expData[expDataIndex]);
                    expDataIndex++;
                    cb();
                  }, function(err) {
                    expect(err).equal(null);
                    done();
                  });
                });
          });

      describe(
          "iterateOverClusterImages",
          function() {

            it(
                "should return node data of all images on all the nodes of the cluster",
                function(done) {
                  var expDataIndex = 0;
                  utils
                      .iterateOverClusterImages(
                          grunt,
                          options,
                          function(data, cb) {
                            expect(JSON.parse(JSON.stringify(data)))
                                .eql(
                                    JSON
                                        .parse(JSON
                                            .stringify(iterateOverClusterImages[expDataIndex])));
                            expDataIndex++;
                            cb();
                          }, function(err) {
                            done();
                          });
                });
          });

      describe("iterateOverNodesWithSSHAlias", function() {
        it("should return node data of selected nodes with SSH alias", function(done) {
          var n=0;
          var nodeNames= [ "oaalias-1-computing", "oaalias-2-computing", "oaalias-3-computing", "oaalias-1-loadbalancer" ];
          utils.iterateOverNodes(
              _.extend(options, {cluster: "oaalias",  clusterAliases: grunt.customConfig.clusterAliases["oaalias"]}), 
              function(node) {
                return true;
          }, function(data, cb) {
            expect(nodeNames.indexOf(data.node.name) >= 0).equal(true);
            n++;
            cb();
          }, function(err) {
            expect(err).equal(null);
            expect(n).equal(nodeNames.length);
            done();
          });
        });

      });
    });