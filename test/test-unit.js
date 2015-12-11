var grunt = require("grunt");
var gruntFile = require("./Gruntfile.js")(grunt);
var options = grunt.config().clouddity;

var expect = require("chai").expect;
var SandboxedModule = require("sandboxed-module");

// Test data
var servers = require("./data/servers.json");
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
      }
    }
  },
  globals : [],
  locals : {}
});

describe("clouddity", function() {

  describe("iterateOverNodes", function() {

    var expDataIndex = 0;

    it("should return node data", function(done) {
      utils.iterateOverNodes(options, [ {
        name : "oa-1-computing"
      }, {
        name : "oa-2-computing"
      }, {
        name : "oa-1-loadbalancer"
      } ], function(data, cb) {
        expect(JSON.parse(JSON.stringify(data))).eql(
            JSON.parse(JSON.stringify(iterateOverNodes[expDataIndex])));
        expDataIndex++;
        cb();
      }, function(err) {
        expect(err).equal(null);
        done();
      });
    });
  });

});