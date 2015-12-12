/**
 * Utility functions operating to iterate over nodes and images
 */

"use strict";

var pkgcloud = require("pkgcloud"), _ = require("underscore"), grunt = require("grunt");
var async = require("async"), exec = require("child_process").exec, utils = require("../lib/utils");

/**
 * List all the nodes in the cluster
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.listnodes = function(grunt, options, done) {

  grunt.log.ok("Started listing nodes...");

  utils.iterateOverClusterNodes(options, function(node) {
    grunt.log.ok([ node.node.name, node.node.id, node.node.address,
        _.pluck(node.images, "name") ].join(","));
  }, function(err) {
    if (err) {
      done(err);
    }
    grunt.log.ok("Done listing nodes.");
    done();
  });
};
