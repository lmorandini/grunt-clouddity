'use strict';

const _ = require('underscore');
const path = require('path');
const jsonFileImport = require('json-file-import');

module.exports = function (grunt) {

  const cwd = process.cwd();
  process.chdir(`${__dirname}/..`);
  grunt.loadNpmTasks(`grunt-exec`);
  process.chdir(cwd);

  grunt.initConfig({
    gruntfile: {
      src: 'Gruntfile.js'
    },

    clouddity: {
      heat: jsonFileImport.load(path.join(__dirname, 'config',
        'heat.json')),
      openstack: jsonFileImport.load(path.join(__dirname, 'config',
        'openstack.json'))
    },

    exec: {
      /*
      compiletemplate: clouddity.compileTemplate({
        grunt: grunt,
        input: grunt.option('input'),
        output: grunt.option('output')
      }),
      version: clouddity.openstack.version(osOptions),
      listnetworks:
        clouddity.openstack.listnetworks(osOptions),
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
      liststacks:
        clouddity.openstack.liststacks(osOptions),
      liststackresources:
        clouddity.openstack.liststackresources(osOptions),
      showstack:
        clouddity.openstack.showstack(osOptions),
      createstack:
        clouddity.openstack.createstack(osOptions),
      deletestack:
        clouddity.openstack.deletestack(osOptions),
      heatversion:
        clouddity.heat.version(heatOptions)
        */
    }
  });

  grunt.loadTasks("../tasks");

  grunt.registerTask('test', _.map(_.keys(grunt.config.get('exec')), (k) => {
    return 'exec:' + k;
  }));
};
