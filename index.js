'use strict';

const _ = require('underscore');
const ejs = require('ejs');
const os = require('os');
const uniqueFilename = require('unique-filename')

/**
 * Openstack options that take the single dash
 * @type {string[]}
 */
const openstackSingleDashOptions = require('./commands-templates/openstack-singledash.json');

/**
 * Options for different OpenStack clients
 */
const openstack_commands = require('./commands-templates/openstack-commands.json');
const heat_commands = require('./commands-templates/heat-commands.json');

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
 * Retuns Grunt CLI options as an object
 * @param grunt Grunt object
 * @returns {Object}
 */
const getGruntCLIOptions = (grunt) => {
  const fRE = /(\-+)(.+)/;
  const vRE = /(\-+)(.+)=(.+)/;

  const keys = _.map(_.values(grunt.option.flags()), (v) => {
    if (vRE.test(v)) {
      return v.match(vRE)[2];
    }
    if (fRE.test(v)) {
      return v.match(fRE)[2];
    }
    return null;
  });
  const values = _.map(_.values(grunt.option.flags()), (v) => {
    if (vRE.test(v)) {
      return v.match(vRE)[3];
    }
    if (fRE.test(v)) {
      return "";
    }
    return null;
  });

  return _.object(keys, values)
};

module.exports.json2Yaml = ({grunt, input, output, callback}) => {
  const f = uniqueFilename(os.tmpdir()) + '.json';
  return {
    command: () => {
      console.log(`******* ~/git/json-file-import/bin/jsonimport ${input} > ${f} && json2yaml ${f} > ${output}`); // XXX
      return `~/git/json-file-import/bin/jsonimport ${input} > ${f} && json2yaml ${f} > ${output}`;
    },
    stdout: _.isUndefined(grunt.option('verbose')) ? false : grunt.option('verbose'),
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
module.exports.openstack = _.mapObject(openstack_commands,
  (val, key) => {
    return ({grunt, globalOptions, options = {}, output, callback}) => {
      return executeTask({
        grunt, client: 'openstack', obj: val[0], cmd: val[1] ? val[1] : "",
        globalOptions, options, output, callback
      });
    }
  }
);

/**
 * Returns an Object of Grunt tasks: one for every command in heat_commands
 */
module.exports.heat = _.mapObject(heat_commands,
  (val, key) => {
    return ({grunt, globalOptions, options = {}, output, callback}) => {
      return executeTask({
        grunt, client: 'heat', obj: val[0], cmd: val[1] ? val[1] : "",
        globalOptions, options, output, callback
      });
    }
  }
);

/**
 * Returns the options to execute a task in grunt-exec and either a callback
 * or an output type
 *
 * @param grunt {Object} Grunt singleton
 * @param client {String} CLI to call
 * @param obj {String} Object the action acts upom
 * @param cmd {String} Command to execute
 * @param globalOptions {Object} Gloabl options (mainly Authorization)
 * @param options {Object} Other options
 * @param output {String} object type as per OpenStack CLI
 * @param callback {Function} Function to execute upon commmand termination
 * @returns {{cmd: (function(): string), stdout: boolean, callback: Function}}
 */
const executeTask = ({grunt, client, obj, cmd, globalOptions, options = {}, output = 'table', callback}) => {
  let cmdString = [client].concat(
    optionsToCLISwitches({optionsArr: [globalOptions]})).concat(
    [obj, cmd]).concat(
    optionsToCLISwitches({optionsArr: [options, {f: output}]}))
    .concat([grunt.option('verbose') ? '--debug' : '']).join(' ');
  cmdString = ejs.render(cmdString, {
    options: _.extend(_.extend(_.clone(options), globalOptions),
      getGruntCLIOptions(grunt))
  });

  return {
    command: () => {
      return cmdString;
    },
    stdout: _.isUndefined(grunt.option('verbose')) ? false : grunt.option('verbose'),
    callback: _.isFunction(callback) ? callback :
      (error, stdout, stderr) => {
        grunt.log.ok(`${cmdString}`);

        if (error) {
          grunt.log.error(error);
        } else {
          grunt.log.ok(stdout);
        }
      }
  }
};
