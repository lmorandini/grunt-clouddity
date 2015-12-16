var grunt = require("grunt");
var gruntFile = require("./Gruntfile.js")(grunt);
var options = grunt.config().clouddity;

var expect = require("chai").expect;
var SandboxedModule = require("sandboxed-module");

// Test data
var servers = require("./data/servers.json");
var securitygroups = require("./data/securitygroups.json");
var iterateOverNodes = require("./data/iterateOverNodes.json");

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

describe("clouddity", function() {

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
    it("should return security group minus the cluster name", function(done) {
      expect(utils.securitygroupPlainName("oa-http")).equal("http");
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

    it("should return node data of all nodes in the cluster", function(done) {
      var expDataIndex = 3;
      var expData = [ "oa-1-computing", "oa-2-computing", "oa-3-computing",
          "oa-1-loadbalancer" ];
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

    it("should return node data of all nodes in the cluster #2",
        function(done) {
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

  describe("iterateOverSecurityGroups", function() {

    it("should return node data of all security groups in the cluster", function(done) {
      var expDataIndex = 0;
      var expData = [ "oa-consul", "oa-dockerd", "oa-http", "oa-httplb" ];
      utils.iterateOverSecurityGroups(options, function(sec) {
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

    it("should return node data of all security groups in the cluster #2", function(done) {
      var expDataIndex = 0;
      var expData = [ "oa-consul", "oa-dockerd", "oa-http", "oa-httplb" ];
      utils.iterateOverClusterSecurityGroups(options, function(data, cb) {
        expect(data.name).equal(expData[expDataIndex]);
        expDataIndex++;
        cb();
      }, function(err) {
        expect(err).equal(null);
        done();
      });
    });
});

});