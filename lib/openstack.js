/**
 * OpenAPI tasks to automate OpenStack
 */

var commands = {};
var pkgcloud = require("pkgcloud"), _ = require("underscore"), async = require("async"), utils = require("../lib/utils");

/**
 * Adds the security groups that are defined in options.securitygroups
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          pkgcloudClientOptions Options to create the PkgCloud client
 * @param {Object}
 *          dockerClientOptions Options to create the Docker client
 * @param {Object}
 *          options The openapi parameters
 * @param {Function}
 *          done Callback to call when the request is completed
 */
commands.createsecuritygroups = function(grunt, pkgcloudClientOptions,
    dockerClientOptions, options, done) {

  grunt.log.ok("Started creating security groups...");

  // Iterates over the security groups in options and adds them
  var createdGroups = [];
  async.each(_.keys(options.securitygroups), function(grpName, callback) {
    utils.getNetworkClient(pkgcloudClientOptions).createSecurityGroup({
      name : grpName,
      description : options.securitygroups[grpName].description
    }, function(err, result) {
      utils.dealWithError(err, done);
      createdGroups.push({
        id : result.id,
        name : grpName
      });
      grunt.log.ok("Created security group: " + grpName + " " + result.id);
      callback();
    });
  }, function(err) {
    grunt.log.ok("Done creating security groups.");
    done();
  });
};

/**
 * Deletes the security groups that are defined in options.securitygroups
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          pkgcloudClientOptions Options to create the PkgCloud client
 * @param {Object}
 *          dockerClientOptions Options to create the Docker client
 * @param {Object}
 *          options The openapi parameters
 * @param {Function}
 *          done Callback to call when the request is completed
 */
commands.destroysecuritygroups = function(grunt, pkgcloudClientOptions,
    dockerClientOptions, options, done) {

  grunt.log.ok("Started deleting security groups...");

  // Grabs all the security groups
  utils.getNetworkClient(pkgcloudClientOptions).getSecurityGroups(
      options,
      function(err, groups) {
        utils.dealWithError(err, done);

        // Selects only the security groups that have name defined in the
        // options
        var selGroups = _.filter(groups, function(grp) {
          if (_.keys(options.securitygroups).indexOf(grp.name) >= 0) {
            return true
          }
        });

        // Iterates over all the selected security groups and deletes them
        async.each(selGroups, function(grp, callback) {
          utils.getNetworkClient(pkgcloudClientOptions).destroySecurityGroup(
              grp.id,
              function(err, result) {
                grunt.log.ok("Deleted security group: " + grp.name + " "
                    + grp.id + " ");
                utils.dealWithError(err, done);
                callback();
              });
        }, function(err) {
          grunt.log.ok("Done deleting security groups.");
          done();
        });
      });
};

/**
 * Updates the security groups that are defined in options.securitygroups with
 * the server IP addresses that are defined in options.servers
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          pkgcloudClientOptions Options to create the PkgCloud client
 * @param {Object}
 *          dockerClientOptions Options to create the Docker client
 * @param {Object}
 *          options The openapi parameters
 * @param {Function}
 *          done Callback to call when the request is completed
 */
commands.updatesecuritygroups = function(grunt, pkgcloudClientOptions,
    dockerClientOptions, options, done) {

  grunt.log.ok("Started updating security groups...");

  var optServers = utils.getDefinedServers(options.servernamingfunction,
      options.servertypes);

  // Retrieves the server IP addresses
  utils.getComputeClient(pkgcloudClientOptions).getServers(
      {},
      function(err, servers) {
        // Selects only the servers that have name defined in the options
        var selServers = _.filter(servers, function(server) {
          if (_.pluck(optServers, "name").indexOf(server.name) >= 0) {
            return true
          }
        });

        selServers = _.map(selServers, function(server) {
          return {
            id : server.id,
            name : server.name,
            address : server.addresses.public[0],
            type : options.servertypefunction(server.name)
          };
        });

        // Grabs all the security groups
        utils.getNetworkClient(pkgcloudClientOptions).getSecurityGroups(
            options,
            function(err, groups) {
              utils.dealWithError(err, done);

              // Selects only the security groups that have their names
              // defined
              // in the options
              var selGroups = _.filter(groups, function(grp) {
                if (_.keys(options.securitygroups).indexOf(grp.name) >= 0) {
                  return true
                }
              });

              // Iterates over all the selected security groups
              selGroups.forEach(function(grp) {

                // Puts in selRules all the rules of the existing group that
                // have a remoteIpPrefixTemplate or a remoteIpPrefix property
                // defined
                var rulesToAdd = [];
                var selRules = _.filter(options.securitygroups[grp.name].rules,
                    function(rule) {
                      return !_.isUndefined(rule.remoteIpPrefixTemplate)
                          || !_.isUndefined(rule.remoteIpPrefix);
                    });

                // Adds rules to rulesToAdd based on server IP addresses (if
                // remoteIpPrefixTemplate), or remoteIpPrefixTemplate (if
                // remoteIpPrefixTemplate is NOT defined)
                selRules.forEach(function(rule) {

                  if (rule.remoteIpPrefixTemplate) {
                    selServers.forEach(function(server) {
                      if (rule.remoteIpPrefixTemplate === server.type) {
                        rulesToAdd.push({
                          securityGroupId : grp.id,
                          direction : rule.direction,
                          ethertype : rule.ethertype,
                          portRangeMin : rule.portRangeMin,
                          portRangeMax : rule.portRangeMax,
                          protocol : rule.protocol,
                          remoteIpPrefix : server.address
                        });
                      }
                    });
                  }

                  if (rule.remoteIpPrefix) {
                    rulesToAdd.push({
                      securityGroupId : grp.id,
                      direction : rule.direction,
                      ethertype : rule.ethertype,
                      portRangeMin : rule.portRangeMin,
                      portRangeMax : rule.portRangeMax,
                      protocol : rule.protocol,
                      remoteIpPrefix : rule.remoteIpPrefix
                    });
                  }
                });

                // Iterates over rulesToAdd and add them
                async.each(rulesToAdd, function(rule, callback) {
                  utils.getNetworkClient(pkgcloudClientOptions)
                      .createSecurityGroupRule(rule, function(err, result) {
                        utils.dealWithError(err, done);
                        grunt.log.ok("Added rule");
                        callback();
                      }), function(err) {
                    utils.dealWithError(err, done);
                    grunt.log.ok("Done updated security group: " + grp.id);
                  }
                });
              }, function(err) {
                grunt.log.ok("Done updating security groups.");
                done();
              });
            });
      });
};

/**
 * Creates the VMs that are defined in options.servertypes
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          pkgcloudClientOptions Options to create the PkgCloud client
 * @param {Object}
 *          dockerClientOptions Options to create the Docker client
 * @param {Object}
 *          options The openapi parameters
 * @param {Function}
 *          done Callback to call when the request is completed
 */
commands.createservers = function(grunt, pkgcloudClientOptions,
    dockerClientOptions, options, done) {

  grunt.log.ok("Started creating servers...");

  var servers = utils.getDefinedServers(options.servernamingfunction,
      options.servertypes);

  // Iterates over all the nodes and creates them installing Docker as a
  // post-installation step. The security group initially is "default".
  async.each(servers, function(server, callback) {
    utils.getComputeClient(pkgcloudClientOptions).createServer({
      tenantId : pkgcloudClientOptions.tenantName,
      security_groups : utils.securityGroupsAsOpenstack(server.securitygroups),
      user_data : options.user_data,
      availability_zone : options.availability_zone,
      imageRef : server.imageRef,
      flavorRef : server.flavorRef,
      name : server.name,
      key_name : options.key_name
    }, function(err, result) {
      utils.dealWithError(err, done);
      grunt.log.ok("Created server: " + result.id);
      callback();
    });
  }, function(err) {
    grunt.log.ok("Done creating servers.");
    done();
  });
};

/**
 * Deletes the VMs that are defined in options.serverstypes. The servers to be
 * deleted are found by their names (a compistion of servertypes.name, an hypen,
 * and a progressive number.
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          pkgcloudClientOptions Options to create the PkgCloud client
 * @param {Object}
 *          dockerClientOptions Options to create the Docker client
 * @param {Object}
 *          options The openapi parameters
 * @param {Function}
 *          done Callback to call when the request is completed
 */
commands.destroyservers = function(grunt, pkgcloudClientOptions,
    dockerClientOptions, options, done) {

  grunt.log.ok("Started deleting servers...");

  var optServers = utils.getDefinedServers(options.servernamingfunction,
      options.servertypes);

  // Puts in existServers all the servers in the tenancy
  utils.getComputeClient(pkgcloudClientOptions).getServers(
      {},
      function(err, servers) {
        // Selects only the servers that have name defined in the options
        var selServers = _.filter(servers, function(server) {
          if (_.pluck(optServers, "name").indexOf(server.name) >= 0) {
            return true
          }
        });

        // Iterates over the selected servers and deletes them
        async.each(_.pluck(selServers, "id"), function(id, callback) {
          utils.getComputeClient(pkgcloudClientOptions).destroyServer(id,
              function(err, result) {
                grunt.log.ok("Deleted server: " + result.ok);
                utils.dealWithError(err, done);
                callback();
              });
        }, function(err) {
          grunt.log.ok("Done deleting servers.");
          done();
        });
      });
};

module.exports = commands;
