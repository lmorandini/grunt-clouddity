'use strict';

const _ = require('underscore');
const path = require('path');
const jsonFileImport = require('json-file-import');
const clouddity = require('../index.js');

module.exports = function (grunt) {

  const cwd = process.cwd();
  process.chdir(`${__dirname}/..`);
  grunt.loadNpmTasks(`grunt-exec`);
  process.chdir(cwd);

  // Sets extra options to be sent to OpenStack, and the defualt callabck that prints out
  // the OpenStack response
  grunt.heatConfig = jsonFileImport.load(path.join(__dirname, 'config',
    'heat.json'));
  grunt.openstackConfig = jsonFileImport.load(path.join(__dirname, 'config',
    'openstack.json'));
  const osOptions = {
    grunt: grunt, globalOptions: grunt.openstackConfig.osGlobalOptions,
    options: {},
    output: grunt.option('os-format') ? grunt.option('os-format') : "table",
    callback: (err, o, e) => {
      if (grunt.option('verbose') || grunt.option('os-format')) {
        grunt.log.writeln(`${o}`);
      }
    }
  };
  const heatOptions = {
    grunt: grunt, globalOptions: grunt.heatConfig.heatGlobalOptions,
    options: {},
    output: grunt.option('os-format') ? grunt.option('os-format') : "table",
    callback: (err, o, e) => {
      if (grunt.option('verbose') || grunt.option('os-format')) {
        grunt.log.writeln(`${o}`);
      }
    }
  };

  grunt.initConfig({
    gruntfile: {
      src: 'Gruntfile.js'
    },

    exec: {
      compiletemplate: clouddity.json2Yaml({grunt: grunt,
          input: grunt.option('input'),
          output: grunt.option('output')
        }),
      version: clouddity.openstack.version(osOptions),
      listservers:
        clouddity.openstack.listservers(osOptions),
      listrouters:
        clouddity.openstack.listrouters(osOptions),
      listsecuritygroups:
        clouddity.openstack.listsecuritygroups(osOptions),
      listsecuritygrouprules:
        clouddity.openstack.listsecuritygrouprules(osOptions),
      listflavors:
        clouddity.openstack.listflavors(osOptions),
      listimages:
        clouddity.openstack.listimages(osOptions),
      stackcreate:
        clouddity.openstack.stackcreate(osOptions),
      heatversion:
        clouddity.heat.version(heatOptions)
    }
  });

  grunt.registerTask('test', _.map(_.keys(grunt.config.get('exec')), (k) => {
    return 'exec:' + k;
  }));
};
