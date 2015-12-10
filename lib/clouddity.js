/**
 * Utility functions operating to iterate over nodes and images
 */

"use strict";

var pkgcloud = require("pkgcloud"), _ = require("underscore"), grunt = require("grunt"), async = require("async"), exec = require("child_process").exec, utils = require("../lib/utils");

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

  var listIterator = function(pull, next) {

    (new Docker(pull.docker)).pull(pull.repo, pull, function(err, stream) {
      if (err) {
        return next(err);
      }

      stream.setEncoding("utf8");
      stream.on("error", next);
      stream.on("data", function(data) {
        var jsonData = JSON.parse(data);
        if (jsonData && jsonData.error) {
          stream.emit("error", jsonData.error);
        }
      });
      stream.on("end", function() {
        grunt.log.ok("Done pulling image " + pull.image + " from server "
            + pull.server.name);
        next();
      });

    }, pull.auth);

  };
  var doneIterator = function(err) {
    if (err) {
      done(err);
    }
    grunt.log.ok("Done listing nodes.");
    done();
  };

  utils.iterateOverServers(options,
      utils.getDefinedServers(options.servertypes), listIterator, doneIterator);
};