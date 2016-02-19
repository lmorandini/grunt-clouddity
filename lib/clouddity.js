/**
 * Utility functions operating to iterate over nodes and images
 */

"use strict";

var pkgcloud = require("pkgcloud"), _ = require("underscore"), grunt = require("grunt");
var async = require("async"), exec = require("child_process").exec;
var Docker = require("dockerode"), querystring = require("querystring");
var utils = require("../lib/utils");

/**
 * List all the nodes in the cluster
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.listnodes = function(grunt, options, done) {

  grunt.log.ok("name,id,address,images...");

  utils.iterateOverClusterNodes(options, function(node, next) {
    grunt.log.ok([ node.node.name, node.node.id, node.node.address,
        _.pluck(node.images, "name") ].join(","));
    return next();
  }, function(err) {
    utils.dealWithError(err, function(err) {
    });
    done();
  });
};

/**
 * Creates the VMs that are defined in options.nodetypes
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.createnodes = function(grunt, options, done) {

  grunt.log.ok("Started creating nodes...");

  async.each(utils.getDefinedNodes(options), function(node, callback) {

    pkgcloud.compute.createClient(options.pkgcloud.client).createServer(
        {
          tenantId : options.pkgcloud.client.tenantName,
          security_groups : utils.securityGroupsAsOpenstack(options.cluster,
              node.securitygroups),
          user_data : options.pkgcloud.user_data,
          availability_zone : options.pkgcloud.availability_zone,
          imageRef : node.imageRef,
          flavorRef : node.flavorRef,
          name : node.name,
          key_name : options.pkgcloud.key_name
        }, function(err, result) {
          utils.dealWithError(err, callback);
          if (!err) {
            grunt.log.ok("Created node: " + result.name + " " + result.id);
            return callback(err);
          }
        });
  }, function(err) {
    grunt.log.ok("Done creating nodes.");
    if (err) {
      return done(err);
    }
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
 *          options Task options
 * @param {Function}
 *          done Callback to call when the request is completed
 */
module.exports.destroynodes = function(grunt, options, done) {

  grunt.log.ok("Started deleting nodes...");

  utils.iterateOverClusterNodes(options, function(node, callback) {
    pkgcloud.compute.createClient(options.pkgcloud.client).destroyServer(
        node.node.id, function(err, result) {
          utils.dealWithError(err, callback);
          if (!err) {
            grunt.log.ok("Deleted node: " + result.ok);
            return callback(err);
          }
        });
  }, function(err) {
    grunt.log.ok("Done deleting nodes.");
    if (err) {
      return done(err);
    }
    done();
  });
};

/**
 * List all the security groups in the cluster
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.listsecuritygroups = function(grunt, options, done) {

  grunt.log.ok("name,id,rules...");

  utils.iterateOverClusterSecurityGroups(options, function(grp, callback) {
    grunt.log.ok([
        grp.name,
        grp.id,
        _.map(grp.securityGroupRules, function(rule) {
          return "{"
              + [ rule.protocol, rule.direction, rule.ethertype,
                  rule.port_range_min, rule.port_range_max,
                  rule.remote_ip_prefix ].join(",") + "}";
        }) ].join(","));
    return callback();
  }, function(err) {
    if (err) {
      return done(err);
    }
    done();
  });
};

/**
 * Adds the security groups that are defined in options
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the request is completed
 */
module.exports.createsecuritygroups = function(grunt, options, done) {

  grunt.log.ok("Started creating security groups...");

  // Iterates over the security groups in options and adds them
  var createdGroups = [];
  async.each(_.keys(options.securitygroups), function(grpName, callback) {
    pkgcloud.network.createClient(options.pkgcloud.client).createSecurityGroup(
        {
          name : utils.securitygroupName(options.cluster, grpName),
          description : options.securitygroups[grpName].description
        },
        function(err, result) {
          utils.dealWithError(err, done);
          if (!err) {
            createdGroups.push({
              id : result.id,
              name : grpName
            });
            grunt.log.ok("Created security group: "
                + utils.securitygroupName(options.cluster, grpName) + " "
                + result.id);
            return callback(err);
          }
        });
  }, function(err) {
    grunt.log.ok("Done creating security groups.");
    if (err) {
      return done(err);
    }
    done();
  });
};

/**
 * Deletes all the security groups in the cluster
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.destroysecuritygroups = function(grunt, options, done) {

  grunt.log.ok("Started deleting security groups...");

  utils.iterateOverClusterSecurityGroups(options, function(grp, callback) {
    pkgcloud.network.createClient(options.pkgcloud.client)
        .destroySecurityGroup(
            grp.id,
            function(err, result) {
              utils.dealWithError(err, done);
              if (!err) {
                grunt.log.ok("Deleted security group: " + grp.name + " "
                    + grp.id + " ");
                return callback(err);
              }
            });
  }, function(err) {
    grunt.log.ok("Done deleting security groups.");
    if (err) {
      return done(err);
    }
    done();
  });
};

/**
 * Updates the security groups that are defined in options.securitygroups with
 * the server IP addresses that are defined in options.servers
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the request is completed
 */
module.exports.updatesecuritygroups = function(grunt, options, done) {

  grunt.log.ok("Started updating security groups...");

  var nodes = [];

  // Retrieves the nodes data and puts them in nodes
  utils.iterateOverClusterNodes(options, function(node, callback) {
    nodes.push({
      name : node.node.name,
      id : node.node.id,
      address : node.node.address
    });
    return callback();
  }, function(err) {
    if (err) {
      return done(err);
    }

    // Updates security groups by adding the actual rules
    utils.iterateOverClusterSecurityGroups(options, function(grp, callback2) {

      // Puts in selRules all the rules of the existing group
      // that have a remoteIpPrefixTemplate or a remoteIpPrefix
      // property defined
      var rulesToAdd = [];
      var selRules = _.filter(options.securitygroups[utils
          .securitygroupPlainName(grp.name)].rules, function(rule) {
        return rule.remoteIpNodePrefixes || rule.remoteIpPrefix;
      });

      // Adds rules to rulesToAdd based on node IP addresses (if
      // remoteIpNodePrefixes), and/or remoteIpPrefix
      selRules.forEach(function(rule) {

        if (rule.remoteIpNodePrefixes) {
          nodes
              .forEach(function(node) {
                if (rule.remoteIpNodePrefixes
                    .indexOf(utils.nodeType(node.name)) >= 0) {
                  rulesToAdd.push({
                    securityGroupId : grp.id,
                    direction : rule.direction,
                    ethertype : rule.ethertype,
                    portRangeMin : rule.portRangeMin,
                    portRangeMax : rule.portRangeMax,
                    protocol : rule.protocol,
                    remoteIpPrefix : node.address
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

      // Iterates over rulesToAdd and adds them rules
      async.each(rulesToAdd, function(rule, callback3) {
        pkgcloud.network.createClient(options.pkgcloud.client)
            .createSecurityGroupRule(rule, function(err, result) {
              utils.dealWithError(err, done);
              return callback3();
            }, function(err) {
              utils.dealWithError(err, done);
              grunt.log.ok("Updated security group: " + grp.id);
            });
      }, function(err) {
        utils.dealWithError(err, done);
        grunt.log.ok("Updated security group: " + grp.id);
        return callback2();
      });
    }, function(err) {
      if (err) {
        return done(err);
      }

      done();
    });
  });
};

/**
 * Pulls the Docker images from all the nodes defined in Grunt and present in
 * the cluster
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.pull = function(grunt, options, done) {

  grunt.log.ok("Started pulling images.");

  utils.iterateOverClusterImages(grunt, options, function(image, next) {
    grunt.log.ok("Started pulling image " + image.name + " on node "
        + image.node.node.name);

    (new Docker(image.node.docker)).pull(image.repo, image, function(err,
        stream) {
      if (err) {
        return next(err);
      }

      stream.setEncoding("utf8");

      stream.on("error", function(err) {
        return next();
      });

      stream.on("data", function(data) {
        // FIXME: it looks the end of pulling JSON message arrives malformed,
        // hence this work-around is needed to complete the pulling
        try {
          var jsonData = JSON.parse(data);
          if (jsonData && jsonData.error) {
            stream.emit("error", jsonData.error);
          }
        } catch (err) {
          grunt.log.error("Warning pulling image: " + err.message);
        }
      });

      stream.on("end", function() {
        grunt.log.ok("Done pulling image " + image.name + " on node "
            + image.node.node.name);
        return next();
      });
    }, image.auth);

  }, function(err) {
    if (err) {
      return done(err);
    }
    grunt.log.ok("Done pulling images.");
    done();
  });
};

/**
 * Creates the Docker containers for all the nodes and images in the cluster
 * (during this process the cluster IP addresses are added to the /etc/hosts of
 * every node)
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.run = function(grunt, options, done) {

  var hosts = [];

  /*
   * Function to create and run a container from image
   */
  var runIterator = function(image, next) {

    if (!utils
        .isContainerToBeProcessed(grunt, image.node.node.type, image.name)) {
      return next();
    }

    grunt.log.ok("Started creating container from " + image.name + " on node "
        + image.node.node.name);

    // Adds the nodes addresses the the start options
    var createOptions = _.clone(image.options.run.create);
    createOptions.HostConfig = (createOptions.HostConfig) ? createOptions.HostConfig
        : {};

    // Adds all the hosts, and the current node address as Hostname and
    // "dockerhost"
    createOptions.HostConfig.ExtraHosts = hosts.concat("dockerhost" + ":"
        + image.node.node.address);
    if (createOptions.Hostname) {
      createOptions.HostConfig.ExtraHosts.push(createOptions.Hostname + ":"
          + image.node.node.address);
    }

    var streamo = (new Docker(image.node.docker)).run(image.repo,
        image.options.run.cmd, null, createOptions, image.options.run.start,
        function(err, data, container) {
          utils.dealWithError(err, function(err) {
          });
        });

    streamo.on("error", function(err) {
      grunt.verbose.error(err);
      next(err);
    });

    streamo.on("stream", function(stream) {
      stream.on("data", function(chunk) {
        grunt.verbose.ok(chunk);
      })
    });

    streamo.on("container", function(container) {
      grunt.log.ok("Completed creating container " + container.id
          + " from image " + image.name + " on node " + image.node.node.name);
      streamo.emit("end");
    });

    streamo.on("end", function() {
      next();
    });

  };

  // Puts in optServers the nodes names and IP addresses, then executes
  // runIteraotr on them
  grunt.log.ok("Started creating containers.");

  utils.iterateOverClusterNodes(options, function(node, callback) {
    hosts.push(node.node.name + ":" + node.node.address);
    return callback();
  }, function(err) {
    utils.dealWithError(err, done);
    utils.iterateOverClusterImages(grunt, options, runIterator, function(err) {
      utils.dealWithError(err, function(err) {
      });
      grunt.log.ok("Done creating containers.");
      done();
    });
  });

};

/**
 * List all active Docker containers in the cluster.
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.listcontainers = function(grunt, options, done) {

  /*
   * Function to prints information on a container
   */
  var listIterator = function(container, next) {
    grunt.log.ok([ container.node.node.name, container.node.node.address,
        container.container.Image, container.container.Status,
        container.container.Id ].join(","));
    next();
  };

  grunt.log.ok("nodename,address,image,status,containerid");

  utils.iterateOverClusterContainers(grunt, options, listIterator,
      function(err) {
        if (err) {
          return done(err);
        }
        done();
      });

};

/**
 * Starts all Docker containers in the cluster.
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.start = function(grunt, options, done) {

  /*
   * Function to start a container
   */
  var startIterator = function(container, next) {

    if (!utils.isContainerToBeProcessed(grunt, container.node.node.type,
        container.container.Image.match(/\/(.+)\:/)[1])) {
      return next();
    }

    grunt.log.ok("Started starting container " + container.container.Id
        + "  on node " + container.node.node.address);
    (new Docker(container.node.docker)).getContainer(container.container.Id)
        .start({}, function(err, data) {
          utils.dealWithError(err, function(err) {
          });
          next();
        });
  };

  grunt.log.ok("Started starting containers");

  utils.iterateOverClusterContainers(grunt, options, startIterator, function(
      err) {
    utils.dealWithError(err, function(err) {
    });
    grunt.log.ok("Completed starting containers");
    done();
  });

};

/**
 * Stops all Docker containers in the cluster.
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.stop = function(grunt, options, done) {

  /*
   * Function to stop a container
   */
  var stopIterator = function(container, next) {

    if (!utils.isContainerToBeProcessed(grunt, container.node.node.type,
        container.container.Image.match(/\/(.+)\:/)[1])) {
      return next();
    }

    grunt.log.ok("Started stopping container " + container.container.Id
        + "  on node " + container.node.node.address);
    (new Docker(container.node.docker)).getContainer(container.container.Id)
        .stop({}, function(err, data) {
          utils.dealWithError(err, function(err) {
          });
          next();
        });
  };

  grunt.log.ok("Started stopping containers");

  utils.iterateOverClusterContainers(grunt, options, stopIterator,
      function(err) {
        utils.dealWithError(err, function(err) {
        });
        grunt.log.ok("Completed stopping containers");
        done();
      });

};

/**
 * Removes all Docker containers in the cluster.
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.remove = function(grunt, options, done) {

  /*
   * Function to remove a container
   */
  var removeIterator = function(container, next) {

    if (!utils.isContainerToBeProcessed(grunt, container.node.node.type,
        container.container.Image.match(/\/(.+)\:/)[1])) {
      return next();
    }

    grunt.log.ok("Started removing container " + container.container.Id
        + "  on node " + container.node.node.address);
    (new Docker(container.node.docker)).getContainer(container.container.Id)
        .remove({}, function(err, data) {
          utils.dealWithError(err, function(err) {
          });
          next();
        });
  };

  grunt.log.ok("Started removing containers");

  utils.iterateOverClusterContainers(grunt, options, removeIterator, function(
      err) {
    utils.dealWithError(err, function(err) {
    });
    grunt.log.ok("Completed removing containers");
    done();
  });

};

/**
 * Copy data from the client machines to the nodes volumes using the scp
 * command. NOTE: it has to run after the nodes have been created
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.copytohost = function(grunt, options, done) {

  /*
   * Executes all the tests defined in the test property of
   */
  var copyIterator = function(node, nextNode) {
    node.copytohost = _.find(options.nodetypes, function(nodetype) {
      return nodetype.name === node.node.type
    }).copytohost;

    // If no volumes are defined, skips
    if (!node.copytohost || node.copytohost.length === 0) {
      return nextNode();
    }

    grunt.log.ok("Started copying volume on node " + node.node.name);

    async.eachSeries(node.copytohost,
        function(volume, nextVolume) {

          var recursiveOption = require("fs").lstatSync(volume.from)
              .isDirectory() ? "-r" : "";
          exec("scp " + recursiveOption + " -o StrictHostKeyChecking=no -i "
              + options.ssh.privateKeyFile + " " + volume.from + " "
              + options.ssh.username + "@" + node.node.address + ":"
              + volume.to, function(err, stdout, stderr) {
            nextVolume(err);
          });
        }, function(err) {
          nextNode(err);
        });
  };

  // Tests all the containers for all the servers defined in options and present
  // in the cluster
  utils.iterateOverClusterNodes(options, copyIterator, function(err) {
    utils.dealWithError(err, done);
    grunt.log.ok("Completed copying volumes");
    done();
  });
};

/**
 * Tests all the Docker containers in the cluster
 * 
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.test = function(grunt, options, done) {

  grunt.log.ok("Started testing containers...");

  /*
   * Executes all the tests defined in the test property of
   */
  var testIterator = function(node, nextNode) {

    node.test = _.find(options.nodetypes, function(nodetype) {
      return nodetype.name === node.node.type
    }).test;

    // If no tests are defined, skips
    if (!node.test || node.test.length < 1) {
      return nextNode();
    }

    grunt.log.ok("Started testing " + node.node.name);

    async.eachSeries(node.test, function(testcase, nextTestCase) {

      var http = (testcase.protocol === "http") ? require("http")
          : require("https");
      var auth = (testcase.auth) ? testcase.auth.username + ":"
          + testcase.auth.password : null;

      http.get({
        host : node.node.address,
        auth : auth,
        port : testcase.port,
        path : testcase.path + "?" + querystring.stringify(testcase.query)
      }, function(res) {
        var body = "";
        res.on("data", function(data) {
          body += data;
        });
        res.on("error", function(err) {
          grunt.log.error(err);
          nextTestCase();
        });
        res.on("end", function() {
          if (body.indexOf(testcase.shouldStartWith) === 0) {
            grunt.log.ok("Test " + testcase.name + " successfully completed");
          } else {
            grunt.log.error("Test " + testcase.name + " in error");
          }

          nextTestCase();
        });
      }).on("error", function(err) {
        grunt.log.error(err);
        nextTestCase();
      });
    }, function(err) {
      nextNode(err);
    });
  };

  // Tests all the containers for all the servers defined in options and present
  // in the cluster
  utils.iterateOverClusterNodes(options, testIterator, function(err) {
    utils.dealWithError(err, function(err) {
    });
    grunt.log.ok("Completed testing");
    done();
  });
};
