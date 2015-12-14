/**
 * Grunt tasks to deploy on a cluster
 */

"use strict";

var _ = require("underscore");

module.exports = function(grunt) {

  // Puts all the exported functions of the various modules in commands
//  var openstackTasks = require("../lib/openstack");
//  var dockerTasks = require("../lib/docker");
  var commands = require("../lib/clouddity");
//  var commands = _.extend(commands, openstackTasks, dockerTasks);

  // Processes the given command with arg.
  var processCommand = function(command, options, arg) {
    if (!arg) {
      arg = "default";
    }

    if (!commands[command]) {
      grunt.fail.fatal("Command [" + command + "] not found.");
    }

    // Checks arg
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
    func.apply(this, [ grunt, options, callback, arg ]);
  };

  // For each command, creates the grunt task
  _.keys(commands).forEach(
      function(command) {
        grunt.task.registerTask("clouddity:" + command, function(arg) {
          processCommand.apply(this, [ command,
              grunt.config.get("clouddity"), arg ]);
        });
      });

  // Registers the Grunt multi task
  grunt.registerMultiTask("clouddity",
      "Grunt tasks to deploy on a cluster", processCommand);
};
