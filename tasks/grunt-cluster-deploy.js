/**
 * Grunt tasks to deploy on a cluster
 */

"use strict";

var _ = require("underscore");

module.exports = function(grunt) {

  // Puts all the exported functions of the various modules in commands
  var openstackTasks = require("../lib/openstack");
  var dockerTasks = require("../lib/docker");
  var commands = _.extend(openstackTasks, dockerTasks);

  // Process the given command with arg.
  var processCommand = function(command, options, arg) {
    if (!arg) {
      arg = "default";
    }

    if (!commands[command]) {
      grunt.fail.fatal("Command [" + command + "] not found.");
    }

    // Check arg
    if (typeof (commands[command]) !== "function") {
      if (!commands[command][arg]) {
        grunt.fail.fatal("Argument [" + arg + "] for [" + command
            + "] not found.");
      }
    }

    var func = (arg) ? commands[command][arg] : commands[command];
    if (!func) {
      func = commands[command]; // fallback to the main function
    }

    var done = this.async();

    var callback = function(e) {
      if (e) {
        grunt.fail.warn(e);
      }
      done();
    };

    // Passes clients configuration parameters
    var pkgcloudClientOptions = grunt.config
        .get("clusterDeploy.pkgcloud.client");
    var dockerMasterOptions = grunt.config.get("clusterDeploy.docker.master");
    var dockerClientOptions = grunt.config.get("clusterDeploy.docker.client");

    func.apply(this, [ grunt, pkgcloudClientOptions, dockerMasterOptions,
        dockerClientOptions, options, callback, arg ]);
  };

  // For each command, creates the grunt task
  _.keys(commands).forEach(
      function(command) {

        grunt.task.registerTask("clusterdeploy:" + command, function(arg) {
          processCommand.apply(this, [ command,
              grunt.config.get("clusterdeploy"), arg ]);
        });
      });

  // Register the Grunt multi task
  grunt.registerMultiTask("grunt-cluster-deploy",
      "Grunt tasks to deploy on a cluster", processCommand);
};
