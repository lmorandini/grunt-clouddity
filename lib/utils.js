/**
 * General function used throughout the package
 */

"use strict";

var pkgcloud = require("pkgcloud"), _ = require("underscore"), async = require("async"), Docker = require("dockerode");

var VOLUME_SEP = "__", NODE_SEP = "-";

/**
 * Logs an error (if existing) on the Grunt error log, and calls the callback
 * 
 * @param {Object}
 *          err Error object
 * @param {Function}
 *          done Callback
 */
module.exports.dealWithError = function(err, done) {

  if (err) {
    require("grunt").log.error(err.message + " " + JSON.stringify(err.result));
    if (done) {
      return done();
    }
  }
};

/**
 * Returns true if the container is to be processed (that is, either nodetype,
 * nodeid, and containerid Grunt options are both not defined, or the container
 * has the id given in containerId, or the node has the id given in nodeId, or
 * the node has the type given in nodeType
 * 
 * @param {String}
 *          grunt Grunt object
 * @param {String}
 *          nodeType Cluster node type
 * @param {String}
 *          nodeId Cluster node ID
 * @param {String}
 *          imageName Image node name
 * @param {String}
 *          containerId Current container ID
 * 
 * @returns {Boolean}
 */
module.exports.isContainerToBeProcessed = function(grunt, nodeType, nodeId,
    imageName, containerId) {
  return (!grunt.option("nodetype") && !grunt.option("containerid") && !grunt
      .option("nodeid"))
      || (!_.isUndefined(grunt.option("containerid")) && containerId && containerId === grunt
          .option("containerid"))
      || (!_.isUndefined(grunt.option("nodeid")) && nodeId && nodeId === grunt
          .option("nodeid"))
      || (_.isUndefined(grunt.option("nodeid"))
          && !_.isUndefined(grunt.option("nodetype")) && grunt
          .option("nodetype") === nodeType);
};

/**
 * Returns true if the node is to be processed (that is, either nodetype, and
 * nodeid Grunt options are both not defined, or the node has the id given in
 * nodeId, or the node has the type given in nodeType
 * 
 * @param {String}
 *          grunt Grunt object
 * @param {String}
 *          nodeType Cluster node type
 * @param {String}
 *          nFodeId Cluster node ID
 * 
 * @returns {Boolean}
 */
module.exports.isNodeToBeProcessed = function(grunt, nodeType, nodeId) {
  return (!grunt.option("nodetype") && !grunt.option("nodeid"))
      || (!_.isUndefined(grunt.option("nodeid")) && nodeId && nodeId === grunt
          .option("nodeid"))
      || (!_.isUndefined(grunt.option("nodetype"))
          && grunt.option("nodetype") === nodeType && _.find(grunt
          .config("clouddity.nodetypes"), function(nodetype) {
        return nodetype.name === nodeType;
      }));
};

/**
 * Compose the name of the volume given the name of the node to attach and the
 * volume type name
 * 
 * @param {String}
 *          volumeType Type of the volume
 * @param {String}
 *          nodeName Name of the node 
 * 
 * @returns {String} Name of the node
 */
module.exports.volumeName = function(volumeType, nodeName) {
  return volumeType + VOLUME_SEP + nodeName;
};

/**
 * Returns the name of node given volume name
 * 
 * @param {String}
 *          volumeName Name of volume 
 * 
 * @returns {String} Name of the node
 */
module.exports.nodeNameFromVolumeName = function(volumeName) {
  return volumeName.split(VOLUME_SEP) && volumeName.split(VOLUME_SEP)[1];
};

/**
 * Returns the volume type given volume name
 * 
 * @param {String}
 *          volumeName Name of volume 
 * 
 * @returns {String} Generic name of the volume
 */
module.exports.volumeTypeFromVolumeName = function(volumeName) {
  return volumeName.split(VOLUME_SEP) && volumeName.split(VOLUME_SEP)[0];
};

/**
 * Returns the name of node given some parameters
 * 
 * @param {String}
 *          clusterName Name of cluster the node belongs to (must not contain
 *          dashes)
 * @param {String}
 *          nodeType Type of node (must not contain dashes)
 * @param {Number}
 *          seq Sequential number of node
 * 
 * @returns {String} Name of the node
 */
module.exports.nodeName = function(clusterName, nodeType, seq) {
  return clusterName + NODE_SEP + seq + NODE_SEP + nodeType;
};

/**
 * Returns the type of a node given its name
 * 
 * @param {String}
 *          nodeName Name of node
 * 
 * @returns {String} Type of node
 */
module.exports.nodeType = function(nodeName) {
  return nodeName.split(NODE_SEP)[2];
};

/**
 * Returns the cluster of a node given its name
 * 
 * @param {String}
 *          nodeName Name of node
 * 
 * @returns {String} Name of cluster
 */
module.exports.nodeCluster = function(nodeName) {
  return nodeName.split(NODE_SEP)[0];
};

/**
 * Returns the name of security group given some parameters
 * 
 * @param {String}
 *          clusterName Name of cluster the security group belongs to (must not
 *          contain dashes)
 * @param {String}
 *          securityGroupName Name of security group (must not contain dashes)
 * 
 * @returns {String} Name of the secuirty group
 */
module.exports.securitygroupName = function(clusterName, securityGroupName) {
  return clusterName + NODE_SEP + securityGroupName;
};

/**
 * Returns the cluster of a security group given its name
 * 
 * @param {String}
 *          secName Name of security groups
 * 
 * @returns {String} Name of cluster
 */
module.exports.securitygroupCluster = function(secName) {
  return secName.split(NODE_SEP)[0];
};

/**
 * Returns the name of a security group bar its cluster name
 * 
 * @param {String}
 *          secName Name of security groups
 * 
 * @returns {String} Plain name of the secuirty group
 */
module.exports.securitygroupPlainName = function(secName) {
  return secName.split(NODE_SEP)[1];
};

/**
 * Returns a list of servers based on the node types defined in options
 * 
 * @param {Function}
 *          namingFunction Function used to compose the name of a server given
 *          its type and a sequence number
 * @param {Object}
 *          option Task Grunt options
 * @return {Array} Array of Objects containing all server definitions with
 *         replication (name is changed to the actual server one)
 */
module.exports.getDefinedNodes = function(options) {
  var nodes = [];
  var nodeNumber = 0;
  var nodeTypes = options.nodetypes;

  nodeTypes.forEach(function(nodeType) {
    for (var i = 1; i <= nodeType.replication; i++) {
      var node = _.clone(nodeType);
      node.type = nodeType.name;
      node.name = module.exports.nodeName(options.cluster, node.type, i);
      nodes.push(node);
    }
  });

  return nodes;
};

/**
 * Returns security groups in the format favored from OpenStack.
 * 
 * @param {String}
 *          clusterName Name of cluster the security group belongs to (must not
 *          contain dashes)
 * @param {Array}
 *          secGroups Array of security group names
 * @return {Array} Array of Objects with name property only (like:
 *         "[{\"name\":\"secgroup1\"}, {\"name\":\"secgroup2\"}]")
 */
module.exports.securityGroupsAsOpenstack = function(clusterName, secGroups) {
  return _.map(secGroups, function(grp) {
    return {
      name : module.exports.securitygroupName(clusterName, grp)
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
module.exports.qualifiedImageName = function(imageName, registryIn, versionIn) {
  var version = (versionIn) ? ":" + versionIn : "";
  var registry = (registryIn) ? registryIn + "/" : "";
  return registry + imageName + version;
};

/**
 * Executes a function over the servers belonging to the cluster (as defined in
 * the options)
 * 
 * @param {Object}
 *          options Task options
 * @param {Function}
 *          iterator The function is passed an Object containing the iterator
 *          parameters, and a callback function to call when one iteration is
 *          complete (the callback is, if in error, sent an error object)
 * @param {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 */
module.exports.iterateOverClusterNodes = function(options, iterator, done) {
  module.exports.iterateOverNodes(options, function(node) {
    return module.exports.nodeCluster(node.name) === options.cluster
  }, iterator, done);
};

/**
 * Executes a function over the the servers active in the cloud that satisfy a
 * filtering condition (it can be used to select only the nodes in a given
 * cluster, or the nodes of a given type)
 * 
 * @param {Object}
 *          options Task options
 * @param {Function}
 *          selector Function to select nodes to iterate over (it is passed the
 *          node data and must return true if the node is to be selected)
 * @param {Function}
 *          iterator The function is passed an Object containing the iterator
 *          parameters, and a callback function to call when one iteration is
 *          complete (the callback is, if in error, sent an error object)
 * @param {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 */
module.exports.iterateOverNodes = function(options, selector, iterator, done) {

  // Checks the existence of an object that replaces node names with SSH tunnel
  // ports on localhost (the tunnels must be set in advance outside of Grunt)
  var dockerClient, dockerPort, sshHost, sshPort, sshUsername, sshPrivateKeyFile;

  if (_.isUndefined(options.clusterAliases)) {
    dockerClient = pkgcloud.compute.createClient(options.pkgcloud.client);
    dockerPort = function(currNode) {
      return options.docker.client.port;
    };
    sshHost = function(currNode) {
      return currNode.address || currNode.addresses.public[0];
    };
    sshPort = function(node) {
      return (options.ssh && options.ssh.port) || 22;
    };
    sshUsername = function(currNode) {
      return options.ssh && options.ssh.username;
    };
    sshPrivateKeyFile = function(currNode) {
      return options.ssh && options.ssh.privateKeyFile;
    };
  } else {
    dockerClient = {
      getServers : function(dockerOptions, callback) {
        callback(null, options.clusterAliases.nodes);
      }
    };
    dockerPort = function(currNode) {
      var selNode = _.find(options.clusterAliases.nodes, function(node) {
        return currNode.name == node.name;
      });
      return selNode && selNode.addresses ? selNode.addresses.dockerPort : 2375;
    };
    sshHost = function(currNode) {
      return "127.0.0.1";
    };
    sshPort = function(currNode) {
      var selNode = _.find(options.clusterAliases.nodes, function(node) {
        return currNode.name == node.name;
      });
      return selNode && selNode.addresses ? selNode.addresses.sshPort : 22;
    };
    sshUsername = function(currNode) {
      return options.clusterAliases.ssh.username;
    };
    sshPrivateKeyFile = function(currNode) {
      return options.clusterAliases.ssh.privateKeyFile;
    };
  }

  // Retrieves the active nodes IP addresses
  dockerClient.getServers({}, function(err, activeNodes) {
    module.exports.dealWithError(err, done);

    // Selects nodes based on selector
    var selNodes = _.filter(activeNodes, selector);

    // Extracts some data about the selected nodes and puts them back into
    // selNodes
    selNodes = _.map(selNodes, function(node) {
      return {
        id : node.id,
        name : node.name,
        status : node.status,
        address : node.addresses.public[0],
        type : module.exports.nodeType(node.name)
      };
    });

    // Collects data from each nodes that is in selNodes, and sets data for
    // the iterator in the data array
    var data = [];
    selNodes.forEach(function(node) {

      var imageNames = _.filter(options.nodetypes, function(nodetype) {
        return nodetype.name === node.type
      });
      var images = imageNames.length > 0 ? imageNames[0].images : [];

      data.push({
        hosts : node.hosts,
        node : node,
        images : images,
        ssh : {
          host : sshHost(node),
          port : sshPort(node),
          username : sshUsername(node),
          privateKeyFile : sshPrivateKeyFile(node)
        },
        docker : {
          protocol : options.docker.client.protocol,
          host : node.address,
          port : dockerPort(node),
          auth : options.docker.client.auth
        },
        auth : options.docker.client.auth
      });
    });

    // Calls the iterator for all the elements in data
    async.eachSeries(data, iterator, done);
  });
};

/**
 * Executes a function over the active volumes in the cluster
 * 
 * @param {Object}
 *          options Task options
 * @param {Function}
 *          iterator The function is passed an Object containing the security
 *          group parameters, and a callback function to call when one iteration
 *          is complete (the callback is, if in error, sent an error object)
 * @param {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 */
module.exports.iterateOverVolumes = function(options, iterator, done) {

  // Retrieves the active volumes
  pkgcloud.blockstorage.createClient(options.pkgcloud.client).getVolumes(
      function(err, volumes) {
        module.exports.dealWithError(err, done);
        async.eachSeries(_.filter(volumes, function(volume) {
          return _.pluck(options.volumetypes, "name").indexOf(module.exports.volumeTypeFromVolumeName(volume.name)) > -1;
        }), iterator, done);
      });
};

/**
 * Executes a function over the SECURITY GROUPS belonging to the cluster (as
 * defined in the options)
 * 
 * @param {Object}
 *          options Task options
 * @param {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 */
module.exports.iterateOverClusterSecurityGroups = function(options, iterator,
    done) {
  module.exports.iterateOverSecurityGroups(options, function(sec) {
    return module.exports.securitygroupCluster(sec.name) === options.cluster
  }, iterator, done);
};

/**
 * Executes a function over the active security groups in the cluster that
 * satisfy a filtering condition (it can be used to select only the security
 * groups in a given cluster)
 * 
 * @param {Object}
 *          options Task options
 * @param {Function}
 *          selector Function to select security groups to iterate over (it is
 *          passed the security group data and must return true if the group is
 *          to be selected)
 * @param {Function}
 *          iterator The function is passed an Object containing the security
 *          group parameters, and a callback function to call when one iteration
 *          is complete (the callback is, if in error, sent an error object)
 * @param {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 */
module.exports.iterateOverSecurityGroups = function(options, selector,
    iterator, done) {

  // Retrieves the active security groups
  pkgcloud.network.createClient(options.pkgcloud.client).getSecurityGroups(
      function(err, activeGroups) {
        module.exports.dealWithError(err, done);
        // Iterates over all the selected security groups and
        async.eachSeries(_.filter(activeGroups, selector), iterator, done);
      });
};

/**
 * Executes a function over the images of all the nodes in the cluster
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options Task options
 * @param {Function}
 *          iterator The function is passed an Object containing the image, the
 *          node, and a callback function to call when one iteration is complete
 *          (the callback is, if in error, sent an error object)
 * @param {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 */
module.exports.iterateOverClusterImages = function(grunt, options, iterator,
    done) {

  // Iterates over all the nodes in the cluster
  var pulls = [];
  module.exports.iterateOverClusterNodes(options, function(node, callback) {

    // Inject current node data into the Grunt configuration
    grunt.config.set("clouddityRuntime", {
      node : node
    }); // XXX

    // Puts in pulls all the images defined in the Gruntfile that
    // appear in the current node and adds the node parameters
    var defImages = grunt.config.get().dock.options.images;
    var nodePulls = [];
    var dock = grunt.config.get().dock;
    _.keys(defImages).forEach(function(imageName) {
      var image = _.clone(defImages[imageName]);
      image.auth = dock.options.auth;
      image.registry = dock.options.registry;
      image.docker = dock.options.docker
      image.dockerclient = dock.options.dockerclient;
      image.name = imageName;
      image.repo = dock.options.registry + "/" + image.repo + ":" + image.tag;
      image.node = node;
      nodePulls.push(image);
    });
    nodePulls = _.filter(nodePulls, function(image) {
      return node.images.indexOf(image.name) >= 0;
    })

    pulls = pulls.concat(nodePulls);
    callback();

  }, function(err) {
    if (err) {
      return done(err);
    }

    // For every image executes the iterator function
    async.eachSeries(pulls, iterator, function(err) {
      if (err) {
        return done(err);
      }
      done();
    });
  });
};

/**
 * Executes a function over the containers of all the nodes in the cluster
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options Task options
 * @param {Function}
 *          iterator The function is passed an Object with data about node and
 *          container, the node, and a callback function to call when one
 *          iteration is complete (the callback is, if in error, sent an error
 *          object)
 * @param {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 */
module.exports.iterateOverClusterContainers = function(grunt, options,
    iterator, done) {

  // Iterates over all the nodes in the cluster and
  // puts in containers data about the containers running on the current node
  var containers = [];
  module.exports.iterateOverClusterNodes(options, function(node, next) {

    (new Docker(node.docker)).listContainers({
      all : true
    }, function(err, nodeContainers) {
      if (err) {
        grunt.log.error(err);
        return next(err);
      }

      nodeContainers.forEach(function(container) {
        containers.push({
          node : node,
          container : container
        });
      });

      next();
    });
  }, function(err) {
    if (err) {
      grunt.log.error(err);
      return done(err);
    }
    // For every container executes the iterator function and skips errors
    async.eachSeries(containers, iterator, function(err) {
      if (err) {
        grunt.log.error(err);
      }
      done();
    });
  });
};