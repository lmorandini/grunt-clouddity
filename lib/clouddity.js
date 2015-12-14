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
    return callback();
  }, function(err) {
    if (err) {
      return done(err);
    }
    done();
  });
};

/**
 * List all the security groups in the cluster
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.listsecuritygroups = function(grunt, options, done) {

  grunt.log.ok("name,id,rules...");
  utils.iterateOverClusterSecurityGroups(options, function(grp, callback) {
    grunt.log.ok([
        grp.name,
        grp.id,
        _.map(grp.securityGroupRules, function(rule) {
          return [ rule.security_group_id, rule.port_range_min,
              rule.port_range_max, rule.remote_ip_prefix ].join(",");
        }) ].join(","));
    return callback();
  }, function(err) {
    if (err) {
      return done(err);
    }
    done();
  });
};

/**
 * Adds the security groups that are defined in options
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the request is completed
 */
module.exports.createsecuritygroups = function(grunt, options, done) {

  grunt.log.ok("Started creating security groups...");

  // Iterates over the security groups in options and adds them
  var createdGroups = [];
  async.each(_.keys(options.securitygroups), function(grpName, callback) {
    pkgcloud.network.createClient(options.pkgcloud.client).createSecurityGroup(
        {
          name : grpName,
          description : options.securitygroups[grpName].description
        }, function(err, result) {
          utils.dealWithError(err, done);
          createdGroups.push({
            id : result.id,
            name : grpName
          });
          grunt.log.ok("Created security group: " + grpName + " " + result.id);
          return callback();
        });
  }, function(err) {
    grunt.log.ok("Done creating security groups.");
    if (err) {
      return done(err);
    }
    done();
  });
};

/**
 * Deletes all the security groups in the cluster
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.destroysecuritygroups = function(grunt, options, done) {

  grunt.log.ok("Started deleting security groups...");

  utils.iterateOverClusterSecurityGroups(options, function(grp, callback) {
    pkgcloud.network.createClient(options.pkgcloud.client)
        .destroySecurityGroup(
            grp.id,
            function(err, result) {
              grunt.log.ok("Deleted security group: " + grp.name + " " + grp.id
                  + " ");
              utils.dealWithError(err, done);
              return callback(err);
            });
  }, function(err) {
    grunt.log.ok("Done deleting security groups.");
    if (err) {
      return done(err);
    }
    done();
  });
};