/**
 * Grunt tasks to deploy on a cluster
 */

'use strict';

const _ = require('underscore');
const ejs = require('ejs');
const os = require('os');
const path = require('path');
const awilix = require('awilix');
const container = awilix.createContainer({
  injectionMode: awilix.InjectionMode.PROXY
});

/**
 * Commands that have the output option
 * @type {string[]}
 */
const commandsOutput = require('./commands-templates/commands-output.json');

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
const commands = [];

module.exports = function (grunt) {

  // Processes the given command with arg.
  const processCommand = function (command, options, arg) {
    if (!arg) {
      arg = 'default';
    }
    console.log(`********** processCommand command ${command}`); // XXX
    console.log(`********** processCommand options ${JSON.stringify(options)}`); // XXX
    console.log(`********** processCommand arg ${JSON.stringify(arg)}`); // XXX

    if (!commands[command]) {
      grunt.fail.fatal('Command [' + command + '] not found.');
    }

    // Checks arg
    if (typeof (commands[command]) !== 'function') {
      if (!commands[command][arg]) {
        grunt.fail.fatal('Argument [' + arg + '] for [' + command
          + '] not found.');
      }
    }

    var func = (arg) ? commands[command][arg] : commands[command];
    if (!func) {
      func = commands[command]; // fallback to the main function
    }

    const done = this.async();

    const callback = function (e) {
      if (e) {
        grunt.fail.warn(e);
      }
      done();
    };

    // Passes clients configuration parameters
    func.apply(this, [grunt, options, callback, arg]);
  };

  // For each command, creates the grunt task
  _.keys(commands).forEach(
    function (command) {
      console.log(`************** ${command}`); // XXX
      grunt.task.registerTask('clouddity:' + command, function (arg) {
        processCommand.apply(this, [command, grunt.config.get('clouddity'),
          arg]);
      });
    });

  // Registers the Grunt multi task
  grunt.registerMultiTask('clouddity', 'Grunt tasks to deploy on a cluster',
    processCommand);
};

/* XXX
container.register({
  userController: awilix.asClass(UserController)
});
container.resolve('userController');
*/

/**
 * Converts an array of objects to double-dashed CLI options
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

/**
 * Execute a JavaScript file (a template tha must produce JSON) and converts its outptu to YAML.
 * It reuiqrees
 * @param grunt {Object} Grunt object
 * @param input {String} Input file name
 * @param output {String} output file name
 * @param callback {Function} Callback
 * @returns {{command: (function(): string), stdout: boolean, callback: Function}}
 */
//commands['compileTemplate'] = ({grunt, input, output, callback}) => {
commands['compileTemplate'] = ({grunt, options, callback}) => {

  const input = grunt.option('input');
  const output = grunt.option('output');
  console.log(`********** input ${input}`); // XXX
  console.log(`********** options ${JSON.stringify(options)}`); // XXX
  const tpl = path.resolve(input);
  console.log(`********** tpl ${tpl}`); // XXX
  return {
    command: () => {
      // FIXME: jsonimport should be added to the PATH
      return `node ${tpl} | json2yaml > ${output}`;
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
const executeTask = ({grunt, client, obj, cmd, globalOptions, options = {}, output, callback}) => {
  let cmdString = [client].concat(
    optionsToCLISwitches({optionsArr: [globalOptions]})).concat(
    [obj, cmd]).concat(
    optionsToCLISwitches({optionsArr: [options, ((output && commandsOutput.includes(cmd.split(" ")[0])) ? {f: output} : undefined)]}))
    .concat([grunt.option('verbose') ? '--debug' : '']).join(' ');
  cmdString = ejs.render(cmdString, {
    options: _.extend(_.extend(_.clone(options), globalOptions),
      getGruntCLIOptions(grunt))
  });

  return {
    command: () => {
      grunt.log.ok(`${cmdString}`);
      return cmdString;
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
