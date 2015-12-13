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

  grunt.log.ok("name,id,address,images...");
  utils.iterateOverClusterNodes(options, function(node, callback) {
    grunt.log.ok([ node.node.name, node.node.id, node.node.address,
        _.pluck(node.images, "name") ].join(","));
    callback();
  }, function(err) {
    if (err) {
      done(err);
    }
    done();
  });
};
