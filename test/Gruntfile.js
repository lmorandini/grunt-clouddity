'use strict';

const _ = require('underscore');
const jsonFileImport = require('json-file-import');
const clouddity = require('../index.js');

module.exports = function (grunt) {

  const cwd = process.cwd();
  process.chdir(`${__dirname}/..`);
  grunt.loadNpmTasks(`grunt-exec`);
  process.chdir(cwd);

  grunt.swarmConfig = jsonFileImport.load(`${__dirname}/config/openstack.json`);

  grunt.initConfig({
    gruntfile: {
      src: 'Gruntfile.js'
    },

    exec: {
      version: clouddity.version({grunt: grunt, globalOptions: grunt.swarmConfig.osGlobalOptions}),

      listsecuritygroups: clouddity.listsecuritygroups(
        {grunt: grunt, globalOptions: grunt.swarmConfig.osGlobalOptions}),

      listsecuritygroups2: clouddity.listsecuritygroups(
        {
          grunt: grunt, globalOptions: grunt.swarmConfig.osGlobalOptions,
          callback: (err, o, e) => {
            console.log(`****** ${o}`);
          }
        })

    }
  });

  grunt.registerTask('test', ['exec:version',
    'exec:listsecuritygroups', 'exec:listsecuritygroups2']);
};
