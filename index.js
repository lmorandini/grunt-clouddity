'use strict';

const _ = require('underscore');

/**
 * Openstack options that take the single dash
 * @type {string[]}
 */
const openstackSingleDashOptions = require('./openstack-singledash.json');

/**
 * Options for different OpenStack commands
 */
const openstack_commands = require('./openstack-commands.json');

/**
 * Converts an array of obkects to double-dashed CLI options
 * (unless options are listed as sungle-dash options array)
 *
 * @param optionsArr {Array} Array of Objects option names and values
 * @param singleDashOptions {Array} Array of Strings of single-dash option names
 */
const optionsToCLISwitches = ({optionsArr, singleDashOptions = openstackSingleDashOptions}) => {
  return _.map(_.pairs(_.reduce(optionsArr, (e, acc) => {
    return _.extend(acc, e);
  })), (p) => {
    return `${singleDashOptions.includes(p[0]) ? '-' : '--'}${p[0]} ${p[1]}`;
  });
};

/**
 * Returns the options to execute a task in grunt-exec and either a callback
 * or an output type
 *
 * @param grunt {Object} Grunt singleton
 * @param cmd {String} Command and fixed options
 * @param auth {Object} Authorization options
 * @param options {Object} Other options
 * @param output {String} object type as per OpenStack CLI
 * @param callback {Function} Function to execute upon commmand termination
 * @returns {{cmd: (function(): string), stdout: boolean, callback: Function}}
 */
const executeTask = ({grunt, cmd, auth, options = {}, output = 'table', callback}) => {
  return {
    cmd: () => {
      return cmd.concat(
        optionsToCLISwitches({optionsArr: [auth, options, {f: _.isFunction(callback) ? 'json' : output}]}))
        .concat([grunt.option('verbose') ? '--debug' : '']).join(' ');
    },
    stdout: false,
    callback: _.isFunction(callback) ? callback :
      (error, stdout, stderr) => {
        if (error) {
          grunt.log.error(error);
        } else {
          grunt.log.ok(stdout);
        }
      }
  }
};

/**
 * Returns an Object of Grunt tasks: one for every command in openstack_commands
 */
module.exports = _.mapObject(openstack_commands,
  (val, key) => {
    return ({grunt, auth, options = {}, output, callback}) => {
      return executeTask({
        grunt, cmd: val,
        auth, options, output, callback
      });
    }
  }
);
