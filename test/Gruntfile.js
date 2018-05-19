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
      version: clouddity.version({grunt: grunt, auth: grunt.swarmConfig.osAuth}),

      listsecuritygroups: clouddity.listsecuritygroups(
        {grunt: grunt, auth: grunt.swarmConfig.osAuth}),

      listsecuritygroups2: clouddity.listsecuritygroups(
        {
          grunt: grunt, auth: grunt.swarmConfig.osAuth,
          callback: (err, o, e) => {
            console.log(`****** ${o}`);
          }
        })
    }
  });
};
