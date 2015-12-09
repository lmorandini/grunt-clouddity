/**
 * General function used throughout the package
 */

"use strict";

var pkgcloud = require("pkgcloud"), _ = require("underscore"), grunt = require("grunt"), async = require("async"), exec = require("child_process").exec;

// Exports.
var utils = {};

/**
 * Logs an error (if existing) on the Grunt error log, and calls the callback
 * 
 * @param {Object}
 *          err Error object
 * @param {Function}
 *          done Callback
 */
utils.dealWithError = function(err, done) {

  if (_.is(err)) {
    grunt.log.error(err);
    if (_.is(done)) {
      done();
    }
  }
};

/**
 * Returns a compute client based on the given options
 * 
 * @see https://github.com/pkgcloud/pkgcloud/tree/master/docs/providers
 * @param {Object}
 *          options Options for client creation
 * @param {Function}
 *          doneError Callback to call in case of error
 */
utils.getComputeClient = function(options, doneError) {

  try {
    if (!_.is(options)) {
      throw new Error("Missing client configuration");
    }
    return pkgcloud.compute.createClient(options);
  } catch (err) {
    utils.dealWithError(err, doneError);
  }
};

/**
 * Returns a network client based on the given options
 * 
 * @see https://github.com/pkgcloud/pkgcloud/tree/master/docs/providers
 * @param {Object}
 *          options Options for client creation
 * @param {Function}
 *          doneError Callback to call in case of error
 */
utils.getNetworkClient = function(options, doneError) {

  try {
    if (!_.is(options)) {
      throw new Error("Missing client configuration");
    }
    return pkgcloud.network.createClient(options);
  } catch (err) {
    utils.dealWithError(err, doneError);
  }
};

/**
 * Returns a list of servers based on the server types defined in options
 * 
 * @param {Funciton}
 *          namingFunction Function used to compose the name of a server given
 *          its type and a sequence number
 * @param {Object}
 *          serverTypes The server types definition object of Gruntfile
 * @return {Array} Array of Objects containing all server definitions with
 *         replication (name is changed to the actual server one)
 */
utils.getDefinedServers = function(namingFunction, serverTypes) {
  var optServers = [];
  var nodeNumber = 0;

  serverTypes.forEach(function(serverType) {
    var i;
    for (i = 1; i <= serverType.replication; i++) {
      var server = _.clone(serverType);
      server.type = serverType.name;
      server.name = namingFunction(serverType.name, ++nodeNumber);
      optServers.push(server);
    }
  });

  return optServers;
};

/**
 * Returns security groups in the format favored from OpenStack.
 * 
 * @param {Array}
 *          secGroups Array of security group names
 * @return {Array} Array of Objects with name property only (like:
 *         "[{\"name\":\"secgroup1\"}, {\"name\":\"secgroup2\"}]")
 */
utils.securityGroupsAsOpenstack = function(secGroups) {
  return _.map(secGroups, function(e) {
    return {
      name : e
    };
  });
};

/**
 * Returns the complete name of the image (including registry and version)
 * 
 * @param {String}
 *          imageName
 * @param {String}
 *          registryIn
 * @param {String}
 *          versionIn
 * @return {String} The qualified image name
 */
utils.qualifiedImageName = function(imageName, registryIn, versionIn) {
  var version = (versionIn) ? ":" + versionIn : "";
  var registry = (registryIn) ? registryIn + "/" : "";
  return registry + imageName + version;
};

/**
 * Executes a function over the intersection of the servers active in the
 * cluster and the ones passed in a list
 * 
 * @param {Object}
 *          computeClient PkgCloud Compute client
 * @param {Array}
 *          optServers Array of the servers as defined in the configuration
 * @param {Object}
 *          dockerClientOptions Docker-related configuration
 * @param {Function}
 *          serverTypeFunction Function that returns the server type given its
 *          name
 * @param {Function}
 *          iterator Function that is performed for each server (it is called
 *          passing an Object containing the iterator parameters, and a callback
 *          function to call when one iteration is complete
 * @param {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 */
utils.iterateOverServers = function(computeClient, optServers,
    dockerClientOptions, serverTypeFunction, iterator, done) {

  // Retrieves the servers IP addresses
  computeClient.getServers({}, function(err, servers) {

    // Selects only the servers that have their names defined in optServers
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
        type : serverTypeFunction(server.name)
      };
    });

    // Collects data from each servers that is in both optServers and
    // selServers, and sets data for the iterator in the data array
    var data = [];
    selServers.forEach(function(server) {
      var serverType = serverTypeFunction(server.name);
      var imageNames = _.find(optServers, function(optServer) {
        return optServer.type === serverType;
      }).docker.images;
      imageNames.forEach(function(imageName) {
        data.push({
          hosts : optServers.hosts,
          server : server,
          image : imageName,
          run : dockerClientOptions.images[imageName].options.run,
          test : dockerClientOptions.images[imageName].options.test,
          docker : {
            protocol : dockerClientOptions.dockerclient.protocol,
            host : server.address,
            port : dockerClientOptions.dockerclient.port
          },
          auth : dockerClientOptions.auth,
          tag : dockerClientOptions.images[imageName].options.tag,
          repo : dockerClientOptions.images[imageName].options.build.t,
        });
      });
    });

    // Calls the iterator for all the elements in data
    async.eachSeries(data, iterator, done);
  });
};

module.exports = utils;
