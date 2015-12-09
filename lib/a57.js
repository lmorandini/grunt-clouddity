/**
 * Utility functions operating to iterate over nodes and images
 */

"use strict";

var pkgcloud = require("pkgcloud"), _ = require("underscore"), grunt = require("grunt"), async = require("async"), exec = require("child_process").exec;

/**
 * Returns the name of node given some parameters
 * 
 * @param {String}
 *          clusterName Name of cluster the node belongs to (must not contain
 *          dashes)
 * @param {String}
 *          serverType Type of node (must not contain dashes)
 * @param {Number}
 *          seq Sequential number of node
 * 
 * @returns {String} Name of the node
 */
module.exports.nodeName = function(clusterName, serverType, seq) {
  return clusterName + "-" + seq + "-" + serverType;
},

/**
 * Returns the type of a node given its name
 * 
 * @param {String}
 *          nodeName Name of node
 * 
 * @returns {String} Type of node
 */
module.exports.nodeType = function(nodeName) {
  return serverName.split("-")[2];
},

/**
 * Executes a function over the intersection of the servers active in the
 * cluster and the ones passed in a list
 * 
 * @param {Object}
 *          cloudComputeClientOptions PkgCloud Compute client options
 * @param {Object}
 *          dockerClientOptions Docker options
 * @param {Array}
 *          nodes Array of the servers as defined in the Gruntfile
 * @param {Array}
 *          images Array of images as defined in the Gruntfile
 * @param {Funciton}
 *          iterator The function is passed an Object containing the
 *          iterator parameters, and a callback function to call when one
 *          iteration is complete (the callback is, if in error, sent an error
 *          object)
 * @param {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 */
module.exports.iterateOverServers = function(cloudComputeClientOptions,
    dockerClientOptions, nodes, iterators, done) {

  // Retrieves the active nodes IP addresses
  var computeClient = pkgcloud.compute.createClient(options);

  computeClient.getServers({}, function(err, activeNodes) {

    if (err) {

    }

    // Selects only the servers that have their names defined in nodes
    var selNodes = _.filter(activeNodes, function(node) {
      if (_.pluck(nodes, "name").indexOf(node.name) >= 0) {
        return true;
      }
    });

    // Extracts some data about the selected nodes and puts them back into
    // selNodes
    selNodes = _.map(selNodes, function(node) {
      return {
        id : node.id,
        name : node.name,
        address : node.addresses.public[0],
        type : module.exports.nodeType(node.name)
      };
    });

    // Collects data from each servers that is in selServers, and sets data for
    // the iterator in the data array
    var data = [];

    selServers.forEach(function(server) {
      var serverType = module.exports.nodeType(server.name);
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
