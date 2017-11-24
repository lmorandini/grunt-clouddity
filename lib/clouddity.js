/**
 * Utility functions operating to iterate over nodes and images
 */

"use strict";

var pkgcloud = require("pkgcloud"), _ = require("underscore"), grunt = require("grunt");
var async = require("async"), exec = require("child_process").exec;
var Docker = require("dockerode"), querystring = require("querystring");
var utils = require("../lib/utils");
var exec = require("child_process").exec;
var sshExec = function (address, username, cmd, callback) {
  exec(["ssh", username + "@" + address, "-C"].concat(cmd).join(" "),
    callback);
};

/**
 * List all the images available
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.listimages = function (grunt, options, done) {

  grunt.log.ok("id,name,state,ram,vcpus");

  pkgcloud.compute.createClient(options.pkgcloud.client).getImages(
    function (err, images) {
      utils.dealWithError(err, done);
      _.forEach(images, function (image) {
        console.log([image.id, image.name, image.status].join(", "));
      });
      done();
    });
};

/**
 * List all the flaovors available ssh ubuntu@tweet-1-db
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.listflavors = function (grunt, options, done) {

  grunt.log.ok("id,name,ram,disk,vcpus,swap");

  pkgcloud.compute.createClient(options.pkgcloud.client).getFlavors(
    function (err, flavors) {
      utils.dealWithError(err, done);
      _.forEach(flavors, function (flavor) {
        console.log([flavor.id, flavor.name, flavor.ram, flavor.disk,
          flavor.vcpus, flavor.swap].join(", "));
      });
      done();
    });
};

/**
 * List all the volumes available TODO: only the first attachment is returned
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.listvolumes = function (grunt, options, done) {

  grunt.log.ok("id,name,status,size,volumetype,host_name,device,description");

  utils.iterateOverVolumes(options, function (volume, next) {
    grunt.log.ok([volume.id, volume.name, volume.status, volume.size,
      volume.volumeType,
      volume.attachments[0] && volume.attachments[0].host_name,
      volume.attachments[0] && volume.attachments[0].device,
      volume.description].join(", "));
    return next();
  }, function (err) {
    utils.dealWithError(err, function (err) {
    });
    done();
  });
};

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
module.exports.listnodes = function (grunt, options, done) {

  if (!grunt.option("hosts-format")) {
    grunt.log.ok("name,id,address,status,images...");
  }

  utils.iterateOverClusterNodes(options, function (node, next) {
    if (!grunt.option("hosts-format")) {
      grunt.log.ok([node.node.name, node.node.id, node.node.address,
        node.node.status, _.pluck(node.images, "name")].join(","));
    } else {
      console.log([node.node.address, node.node.name].join(" "));
    }
    return next();
  }, function (err) {
    utils.dealWithError(err, function (err) {
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
module.exports.createnodes = function (grunt, options, done) {

  grunt.log.ok("Started creating nodes...");

  var selNodes = _.filter(utils.getDefinedNodes(options), function (node) {
    return (grunt.option("nodetype") && node.type.toLowerCase() === grunt.option("nodetype").toLowerCase()) || !grunt.option("nodetype") ? true : false;
  });
  async.each(selNodes, function (node, callback) {

    pkgcloud.compute.createClient(options.pkgcloud.client).createServer(
      {
        securityGroups: utils.securityGroupsAsOpenstack(options.cluster,
          node.securitygroups),
        cloudConfig: options.pkgcloud.user_data,
        image: node.imageRef,
        flavor: node.flavorRef,
        name: node.name,
        keyname: options.pkgcloud.key_name,
        availability_zone: node.availability_zone
      }, function (err, result) {
        utils.dealWithError(err, callback);
        if (!err) {
          grunt.log.ok("Created node: " + result.name + " " + result.id);
          return callback(err);
        }
      });
  }, function (err) {
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
module.exports.destroynodes = function (grunt, options, done) {

  grunt.log.ok("Started deleting nodes...");

  utils.iterateOverClusterNodes(options, function (node, callback) {
    pkgcloud.compute.createClient(options.pkgcloud.client).destroyServer(
      node.node.id, function (err, result) {
        utils.dealWithError(err, callback);
        if (!err) {
          grunt.log.ok("Deleted node: " + result.ok);
          return callback(err);
        }
      });
  }, function (err) {
    grunt.log.ok("Done deleting nodes.");
    if (err) {
      return done(err);
    }
    done();
  });
};

/**
 * Creates the volumes that are defined in options.volumes
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.createvolumes = function (grunt, options, done) {

  grunt.log.ok("Started creating volumes...");

  utils.iterateOverClusterNodes(options, function (node, nextNode) {

    var nodetypeOptions = _.find(options.nodetypes, function (nodetype) {
      return nodetype.name === node.node.type
    });

    async.each(nodetypeOptions.volumes, function (volumeTypeName, nextVolume) {
      var volumeType = _.find(options.volumetypes, function (volumetype) {
        return volumetype.name === volumeTypeName;
      });

      pkgcloud.blockstorage.createClient(options.pkgcloud.client).createVolume(
        _.extend(_.clone(volumeType), {
          name: utils.volumeName(volumeType.name, node.node.name)
        }), function (err, result) {
          utils.dealWithError(err, nextVolume);
          grunt.log.ok("Created volume: " + result.name);
          nextVolume();
        });
    }, function (err) {
      grunt.log.ok("Done creating volumes for node " + node.node.name);
      utils.dealWithError(err, nextNode);
      nextNode();
    });
  }, function (err) {
    grunt.log.ok("Done creating volumes.");
    utils.dealWithError(err, done);
    done();
  });
};

/**
 * Attaches to nodes the volumes that are defined in options.volumes
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.attachvolumes = function (grunt, options, done) {

  grunt.log.ok("Started attaching volumes...");

  utils.iterateOverClusterNodes(options, function (node, nextNode) {

    utils.iterateOverVolumes(options, function (volume, nextVolume) {

      if (utils.volumeName(utils.volumeTypeFromVolumeName(volume.name),
          node.node.name) === volume.name) {
        pkgcloud.compute.createClient(options.pkgcloud.client).attachVolume(
          node.node.id, volume.id, function (err, result) {
            utils.dealWithError(err, nextVolume);
            grunt.log.ok("Attached volume: " + JSON.stringify(result));
            nextVolume();
          });
      } else {
        nextVolume();
      }
    }, function (err) {
      grunt.log.ok("Done attaching volumes for node " + node.node.address);
      utils.dealWithError(err, function (err) {
      });
      nextNode();
    });
  }, function (err) {
    utils.dealWithError(err, done);
    done();
  });
};

/**
 * Mount volumes that are defined in options.volumes to nodes
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.mountvolumes = function (grunt, options, done) {

  grunt.log.ok("Started mounting volumes...");
  var username = options.pkgcloud.client.sshusername;

  utils.iterateOverClusterNodes(options, function (node, nextNode) {

    utils.iterateOverVolumes(options, function (volume, nextVolume) {
      var volumeType = _.find(options.volumetypes, function (type) {
        return type.name === utils.volumeTypeFromVolumeName(volume.name);
      });
      if (volumeType
        && volume.attachments[0]
        && utils.volumeName(utils.volumeTypeFromVolumeName(volume.name),
          node.node.name) === volume.name) {
        grunt.log.ok("Started mounting volume " + volume.attachments[0].device
          + " on " + volumeType.mountpoint);
        sshExec(node.node.address, username, "'sudo mkdir "
          + volumeType.mountpoint + "; sudo mkfs -t " + volumeType.fstype
          + " " + volume.attachments[0].device + "; sudo mount -t auto "
          + volume.attachments[0].device + " " + volumeType.mountpoint + "'",
          function (err, stdout, stderr) {
            utils.dealWithError(err, function (err) {
            });
            nextVolume();
          });
      } else {
        nextVolume();
      }
    }, function (err) {
      grunt.log.ok("Done mounting volumes for node " + node.node.address);
      utils.dealWithError(err, function (err) {
      });
      nextNode();
    });
  }, function (err) {
    utils.dealWithError(err, done);
    done();
  });
};

/**
 * Detaches the volumes from nodes that are defined in options.volumes
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.detachvolumes = function (grunt, options, done) {

  grunt.log.ok("Started detaching volumes...");
  var client = pkgcloud.compute.createClient(options.pkgcloud.client);

  utils.iterateOverClusterNodes(options, function (node, nextNode) {
    grunt.log.ok("node: " + node.node.id); // XXX

    client.getVolumeAttachments(node.node.id,
      function (err, attachments, result) {
        utils.dealWithError(err, nextNode);
        async.each(attachments, function (attachment, nextAttachment) {
          utils.dealWithError(err, nextAttachment);
          client.detachVolume(attachment.serverId, attachment.id, function (err) {
            utils.dealWithError(err, nextAttachment);
            grunt.log.ok("Detached volume: " + attachment.volumeId);
            nextAttachment();
          });
        }, function (err) {
          grunt.log
            .ok("Done detaching volumes for node " + node.node.address);
          utils.dealWithError(err, nextNode);
          nextNode();
        });
      });
  }, function (err) {
    utils.dealWithError(err, done);
    done();
  });
};

/**
 * Deletes the volumes (provided thery are no attached to nodes)
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options Task options
 * @param {Function}
 *          done Callback to call when the request is completed
 */
module.exports.deletevolumes = function (grunt, options, done) {

  // FIXME: pkgcloud deleteVolume does not seem to work
  grunt.log.ok("Started deleting volumes");

  utils.iterateOverVolumes(options, function (volume, next) {

    grunt.log.ok(volume.id);
    pkgcloud.blockstorage.createClient(options.pkgcloud.client).deleteVolume(
      volume.id, function (err, result) {
        grunt.log.ok(JSON.stringify(err) + " - " + JSON.stringify(result));
        utils.dealWithError(err, next);
        grunt.log.ok("Deleted volume: " + volume.name);
      });
    next();
  }, function (err) {
    utils.dealWithError(err, function (err) {
    });
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
module.exports.listsecuritygroups = function (grunt, options, done) {

  grunt.log.ok("name,id,rules...");

  utils.iterateOverClusterSecurityGroups(options, function (grp, callback) {
    grunt.log.ok([
      grp.name,
      grp.id,
      _.map(grp.securityGroupRules, function (rule) {
        return "{"
          + [rule.protocol, rule.direction, rule.ethertype,
            rule.port_range_min, rule.port_range_max,
            rule.remote_ip_prefix].join(",") + "}";
      })].join(","));
    return callback();
  }, function (err) {
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
module.exports.createsecuritygroups = function (grunt, options, done) {

  grunt.log.ok("Started creating security groups...");

  // Iterates over the security groups in options and adds them
  var createdGroups = [];
  async.each(_.keys(options.securitygroups), function (grpName, callback) {
    pkgcloud.network.createClient(options.pkgcloud.client).createSecurityGroup(
      {
        name: utils.securitygroupName(options.cluster, grpName),
        description: options.securitygroups[grpName].description
      },
      function (err, result) {
        utils.dealWithError(err, done);
        if (!err) {
          createdGroups.push({
            id: result.id,
            name: grpName
          });
          grunt.log.ok("Created security group: "
            + utils.securitygroupName(options.cluster, grpName) + " "
            + result.id);
          return callback(err);
        }
      });
  }, function (err) {
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
module.exports.destroysecuritygroups = function (grunt, options, done) {

  grunt.log.ok("Started deleting security groups...");

  utils.iterateOverClusterSecurityGroups(options, function (grp, callback) {
    pkgcloud.network.createClient(options.pkgcloud.client)
      .destroySecurityGroup(
        grp.id,
        function (err, result) {
          utils.dealWithError(err, done);
          if (!err) {
            grunt.log.ok("Deleted security group: " + grp.name + " "
              + grp.id + " ");
            return callback(err);
          }
        });
  }, function (err) {
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
module.exports.updatesecuritygroups = function (grunt, options, done) {

  grunt.log.ok("Started updating security groups...");

  var nodes = [];

  // Retrieves the nodes data and puts them in nodes
  utils.iterateOverClusterNodes(options, function (node, callback) {
    nodes.push({
      name: node.node.name,
      id: node.node.id,
      address: node.node.address
    });
    return callback();
  }, function (err) {
    utils.dealWithError(err, done);

    // Updates security groups by adding the actual rules
    utils.iterateOverClusterSecurityGroups(options, function (grp, callback2) {

      // Puts in selRules all the rules of the existing group
      // that have a remoteIpPrefixTemplate or a remoteIpPrefix
      // property defined
      var rulesToAdd = [];
      var selRules = _.filter(options.securitygroups[utils
        .securitygroupPlainName(grp.name)].rules, function (rule) {
        return rule.remoteIpNodePrefixes || rule.remoteIpPrefix;
      });

      // Adds rules to rulesToAdd based on node IP addresses (if
      // remoteIpNodePrefixes), and/or remoteIpPrefix
      selRules.forEach(function (rule) {

        if (rule.remoteIpNodePrefixes) {
          nodes
            .forEach(function (node) {
              if (rule.remoteIpNodePrefixes
                  .indexOf(utils.nodeType(node.name)) >= 0) {
                rulesToAdd.push({
                  securityGroupId: grp.id,
                  direction: rule.direction,
                  ethertype: rule.ethertype,
                  portRangeMin: rule.portRangeMin,
                  portRangeMax: rule.portRangeMax,
                  protocol: rule.protocol,
                  remoteIpPrefix: node.address
                });
              }
            });
        }

        if (rule.remoteIpPrefix) {
          rulesToAdd.push({
            securityGroupId: grp.id,
            direction: rule.direction,
            ethertype: rule.ethertype,
            portRangeMin: rule.portRangeMin,
            portRangeMax: rule.portRangeMax,
            protocol: rule.protocol,
            remoteIpPrefix: rule.remoteIpPrefix
          });
        }
      });

      // Iterates over rulesToAdd and adds them rules
      async.each(rulesToAdd, function (rule, callback3) {
        pkgcloud.network.createClient(options.pkgcloud.client)
          .createSecurityGroupRule(rule, function (err, result) {
            utils.dealWithError(err, function (err) {
            });
            callback3();
          }, function (err) {
            utils.dealWithError(err, function (err) {
            });
          });
      }, function (err) {
        utils.dealWithError(err, function (err) {
        });
        grunt.log.ok("Updated security group: " + grp.id);
        callback2();
      });
    }, function (err) {
      utils.dealWithError(err, function (err) {
      });
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
module.exports.pull = function (grunt, options, done) {

  grunt.log.ok("Started pulling images.");

  utils.iterateOverClusterImages(grunt, options, function (image, next) {
    grunt.log.ok("Started pulling image " + image.name + " on node "
      + image.node.node.name);

    (new Docker(image.node.docker)).pull(image.repo, image, function (err,
                                                                      stream) {
      if (err) {
        return next(err);
      }

      stream.setEncoding("utf8");

      stream.on("error", function (err) {
        grunt.log.error(err);
        next(err);
      });

      stream.on("data", function (data) {
        // FIXME: it looks the end of pulling JSON message arrives malformed,
        // hence this work-around is needed to complete the pulling
        grunt.verbose.ok(data);
        try {
          var jsonData = JSON.parse(data);
          if (jsonData && jsonData.error) {
            stream.emit("error", jsonData.error);
          }
        } catch (err) {
          grunt.log.error("Warning pulling image: " + err.message);
        }
      });

      stream.on("end", function () {
        grunt.log.ok("Done pulling image " + image.name + " on node "
          + image.node.node.name);
        next();
      });
    }, image.auth);

  }, function (err) {
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
module.exports.run = function (grunt, options, done) {

  var hosts = [];

  /*
   * Function to create and run a container from image
   */
  var runIterator = function (image, next) {

    if (!utils.isContainerToBeProcessed(grunt, image.node.node.type,
        image.node.node.id, image.name, null)) {
      return next();
    }

    grunt.log.ok("Started creating and running the container from "
      + image.name + " on node " + image.node.node.name);

    // Adds the nodes addresses the the start options
    var createOptions = _.clone(image.options.run.create);
    createOptions.HostConfig = (createOptions.HostConfig) ? createOptions.HostConfig
      : {};

    // If the newtwork mode is not "host", adds all the hosts, and the current
    // node address as Hostname and "dockerhost"
    if (!createOptions.HostConfig.NetworkMode
      || createOptions.HostConfig.NetworkMode.toLowerCase() !== "host") {
      createOptions.HostConfig.ExtraHosts = hosts.concat("dockerhost" + ":"
        + image.node.node.address);
      if (createOptions.Hostname) {
        createOptions.HostConfig.ExtraHosts.push(createOptions.Hostname + ":"
          + image.node.node.address);
      }
    }

    // Adds host alias defined (in the Gruntfile), an array of: <host
    // name>:<alias>
    if (createOptions["clouddity:HostAliases"]) {
      createOptions["clouddity:HostAliases"]
        .forEach(function (alias) {
          var aliasHost = _.find(hosts, function (host) {
            return host.split(":")[0] === alias.split(":")[0];
          });

          if (!aliasHost) {
            grunt.log
              .error("Host "
                + alias
                + " referenced in HostAliases does not seem to exist in the cluster");
            return;
          }

          createOptions.HostConfig.ExtraHosts.push(alias.split(":")[1] + ":"
            + aliasHost.split(":")[1]);
        });
    }

    // FIXME: the current host's image name should be deleted from ExtraHosts
    // ["scats-1-master:115.146.95.194","scats-1-slave:115.146.95.192","dockerhost:115.146.95.192","sparkslave:115.146.95.192","sparkmaster:115.146.95.194"]
    // ["scats-1-master:115.146.95.194","scats-1-slave:115.146.95.192","dockerhost:115.146.95.194","sparkmaster:115.146.95.194"]
    var cluster_env = "CLUSTER_NODES_LIST=" + hosts.join(',');
    createOptions.Env = createOptions.Env ? createOptions.Env
      .concat(cluster_env) : [cluster_env];
    var streamo = (new Docker(image.node.docker)).run(image.repo,
      image.options.run.cmd, null, createOptions, image.options.run.start,
      function (err, data, container) {
        utils.dealWithError(err, function (err) {
        });
      });

    streamo.on("error", function (err) {
      grunt.verbose.error(err);
      next(err);
    });

    streamo.on("stream", function (stream) {
      stream.on("data", function (chunk) {
        grunt.verbose.ok(chunk);
      })
    });

    streamo.on("container", function (container) {
      // NOTE: The start of a container that should be started already is a
      // cautionary measure to avoid this Docker Remote API bug
      // https://github.com/logstash-plugins/logstash-output-elasticsearch/issues/273
      (new Docker(image.node.docker)).getContainer(container.id).start(
        {},
        function (err, data) {
          // This error is ignored, since it will raised in the vast majority
          // of cases, since the container has started already
          utils.dealWithError(err, function (err) {
          });
          grunt.log.ok("Completed creating and running the container "
            + container.id + " from image " + image.name + " on node "
            + image.node.node.name);
          streamo.emit("end");
        });
    });

    streamo.on("end", function () {
      next();
    });

  };

  // Puts in optServers the nodes names and IP addresses, then executes
  // runIteraotr on them
  grunt.log.ok("Started creating containers.");

  utils.iterateOverClusterNodes(options, function (node, callback) {
    hosts.push(node.node.name + ":" + node.node.address);
    return callback();
  }, function (err) {
    utils.dealWithError(err, done);
    hosts.sort();
    utils.iterateOverClusterImages(grunt, options, runIterator, function (err) {
      utils.dealWithError(err, function (err) {
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
module.exports.listcontainers = function (grunt, options, done) {

  /*
   * Function to prints information on a container
   */
  var listIterator = function (container, next) {
    grunt.log.ok([container.node.node.name, container.node.node.address,
      container.container.Image, container.container.Status,
      container.container.Id].join(","));
    next();
  };

  grunt.log.ok("nodename,address,image,status,containerid");

  utils.iterateOverClusterContainers(grunt, options, listIterator,
    function (err) {
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
module.exports.start = function (grunt, options, done) {

  /*
   * Function to start a container
   */
  var startIterator = function (container, next) {

    if (!utils.isContainerToBeProcessed(grunt, container.node.node.type,
        container.node.node.id, container.container.Image.match(/\/(.+)\:/)
        && container.container.Image.match(/\/(.+)\:/)[1],
        container.container.Id)) {
      return next();
    }

    grunt.log.ok("Started starting container " + container.container.Id
      + "  on node " + container.node.node.address);
    (new Docker(container.node.docker)).getContainer(container.container.Id)
      .start({}, function (err, data) {
        utils.dealWithError(err, function (err) {
        });
        next();
      });
  };

  grunt.log.ok("Started starting containers");

  utils.iterateOverClusterContainers(grunt, options, startIterator, function (err) {
    utils.dealWithError(err, function (err) {
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
module.exports.stop = function (grunt, options, done) {

  /*
   * Function to stop a container
   */
  var stopIterator = function (container, next) {

    if (!utils.isContainerToBeProcessed(grunt, container.node.node.type,
        container.node.node.id, container.container.Image.match(/\/(.+)\:/)
        && container.container.Image.match(/\/(.+)\:/)[1],
        container.container.Id)) {
      return next();
    }

    grunt.log.ok("Started stopping container " + container.container.Id
      + "  on node " + container.node.node.address);
    (new Docker(container.node.docker)).getContainer(container.container.Id)
      .stop({}, function (err, data) {
        utils.dealWithError(err, function (err) {
        });
        next();
      });
  };

  grunt.log.ok("Started stopping containers");

  utils.iterateOverClusterContainers(grunt, options, stopIterator,
    function (err) {
      utils.dealWithError(err, function (err) {
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
module.exports.remove = function (grunt, options, done) {

  /*
   * Function to remove a container
   */
  var removeIterator = function (container, next) {
    if (!utils.isContainerToBeProcessed(grunt, container.node.node.type,
        container.node.node.id, container.container.Image.match(/\/(.+)\:/)
        && container.container.Image.match(/\/(.+)\:/)[1],
        container.container.Id)) {
      return next();
    }

    grunt.log.ok("Started removing container " + container.container.Id
      + "  on node " + container.node.node.address);
    (new Docker(container.node.docker)).getContainer(container.container.Id)
      .remove({}, function (err, data) {
        utils.dealWithError(err, function (err) {
        });
        next();
      });
  };

  grunt.log.ok("Started removing containers");

  utils.iterateOverClusterContainers(grunt, options, removeIterator, function (err) {
    utils.dealWithError(err, function (err) {
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
module.exports.copytohost = function (grunt, options, done) {

  /*
   * Copies data to the node machine
   */
  var copyIterator = function (node, nextNode) {
    if (!utils.isNodeToBeProcessed(grunt, node.node.type, node.node.id)) {
      return nextNode();
    }

    node.copytohost = _.find(options.nodetypes, function (nodetype) {
      return nodetype.name === node.node.type
    }).copytohost;

    // If no volumes are defined, skips
    if (!node.copytohost || node.copytohost.length === 0) {
      return nextNode();
    }

    grunt.log.ok("Started copying volume on node " + node.node.name);

    async.eachSeries(node.copytohost,
      function (volume, nextVolume) {

        var recursiveOption = require("fs").lstatSync(volume.from)
          .isDirectory() ? "-r" : "";

        exec("scp " + recursiveOption + " -o StrictHostKeyChecking=no -i "
          + node.ssh.privateKeyFile + " -P " + node.ssh.port + " "
          + volume.from + " " + node.ssh.username + "@" + node.ssh.host
          + ":" + volume.to, function (err, stdout, stderr) {
          nextVolume(err);
        });

      }, function (err) {
        nextNode(err);
      });
  };

  // Copies data as defined in options and present in the cluster
  utils.iterateOverClusterNodes(options, copyIterator, function (err) {
    utils.dealWithError(err, done);
    grunt.log.ok("Completed copying volumes");
    done();
  });
};

/**
 * Executes a command on all Docker containers in the cluster.
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.exec = function (grunt, options, done) {

  if (!grunt.option("command")) {
    utils.dealWithError({
      message: "Command option should not be empty"
    }, function (err) {
    });
    return done();
  }

  var execIterator = function (container, next) {
    if (!utils.isContainerToBeProcessed(grunt, container.node.node.type,
        container.node.node.id, container.container.Image.match(/\/(.+)\:/)
        && container.container.Image.match(/\/(.+)\:/)[1],
        container.container.Id)) {
      return next();
    }

    grunt.log.ok("Started executing command on container "
      + container.container.Id + "  on node " + container.node.node.address);
    (new Docker(container.node.docker)).getContainer(container.container.Id)
      .exec({
        AttachStdout: true,
        AttachStderr: true,
        Cmd: grunt.option("command").split(" ")
      }, function (err, exec) {
        utils.dealWithError(err, next);
        exec.start({}, function (err, stream) {
          utils.dealWithError(err, function (err) {
          });
          stream.on("data", function (chunk) {
            grunt.log.ok(String(chunk));
          });
          stream.on("end", function () {
            next();
          });
        });
      });
  };

  grunt.log.ok("Started executing command on containers");

  utils.iterateOverClusterContainers(grunt, options, execIterator,
    function (err) {
      utils.dealWithError(err, function (err) {
      });
      grunt.log.ok("Completed executing commands on containers");
      done();
    });

};

/**
 * Exports a command on all Docker containers in the cluster.
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.export = function (grunt, options, done) {

  /*
   * Function to export a container
   */
  var exportIterator = function (container, next) {
    if (!utils.isContainerToBeProcessed(grunt, container.node.node.type,
        container.node.node.id, container.container.Image.match(/\/(.+)\:/)
        && container.container.Image.match(/\/(.+)\:/)[1],
        container.container.Id)) {
      return next();
    }

    var fileName = container.container.Image + "-"
      + container.node.node.address + "-" + container.container.Id + ".tar";
    fileName = fileName.replace(/\//g, "_");
    grunt.log.ok("Started exporting container " + container.container.Id
      + "  on node " + container.node.node.address + " to " + fileName);
    var writeStream = require("fs").createWriteStream(fileName);

    (new Docker(container.node.docker)).getContainer(container.container.Id)
      .export(function (err, data) {
        utils.dealWithError(err, function (err) {
        });
        data.req.res.on("data", function (chunk) {
          writeStream.write(chunk);
        });
        data.req.res.on("end", function () {
          writeStream.end();
        });

        next();
      });
  };

  grunt.log.ok("Started exporting containers");

  utils.iterateOverClusterContainers(grunt, options, exportIterator, function (err) {
    utils.dealWithError(err, function (err) {
    });
    grunt.log.ok("Completed exporting containers");
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
module.exports.test = function (grunt, options, done) {

  grunt.log.ok("Started testing containers...");

  /*
   * Executes all the tests defined in the test property of
   */
  var testIterator = function (node, nextNode) {

    node.test = _.find(options.nodetypes, function (nodetype) {
      return nodetype.name === node.node.type
    }).test;

    // If no tests are defined, skips
    if (!node.test || node.test.length < 1) {
      return nextNode();
    }

    grunt.log.ok("Started testing " + node.node.name);

    async.eachSeries(node.test, function (testcase, nextTestCase) {

      var reqOptions = {
        host: node.node.address,
        method: testcase.method ? testcase.method.toUpperCase() : "GET",
        auth: (testcase.auth) ? testcase.auth.username + ":"
          + testcase.auth.password : null,
        headers: testcase.headers,
        rejectUnauthorized: testcase.rejectUnauthorized,
        port: testcase.port,
        path: testcase.path
        + (testcase.query ? "?" + querystring.stringify(testcase.query)
          : "")
      };
      var reqError = function (err) {
        grunt.log.error("Test " + testcase.name + " in error");
        grunt.log.error(err);
        grunt.log.error(JSON.stringify(reqOptions));
        nextTestCase();
      };
      var req = ((testcase.protocol === "https") ? require("https")
        : require("http")).request(reqOptions, function (res) {
        var body = "";
        res.on("data", function (data) {
          grunt.verbose.ok(data);
          body += data;
        });
        res.on("error", reqError);
        res.on("end",
          function () {
            if (body.indexOf(testcase.shouldStartWith) === 0) {
              grunt.log.ok("Test " + testcase.name
                + " successfully completed");
            } else {
              if (body.indexOf(testcase.shouldContain) >= 0) {
                grunt.log.ok("Test " + testcase.name
                  + " successfully completed");
              } else {
                grunt.log.error("Test " + testcase.name + " in error");
                grunt.log.error(JSON.stringify(reqOptions));
                grunt.log.error(body);
              }
            }

            nextTestCase();
          });
      });

      req.on("error", reqError);
      req.end();
    }, function (err) {
      nextNode(err);
    });
  };

  // Tests all the containers for all the servers defined in options and present
  // in the cluster
  utils.iterateOverClusterNodes(options, testIterator, function (err) {
    utils.dealWithError(err, function (err) {
    });
    grunt.log.ok("Completed testing");
    done();
  });
};

/**
 * Add all hosts in the cluster to the /etc/hosts of every node
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.addhosts = function (grunt, options, done) {

  var hosts = [];
  var username = options.pkgcloud.client.sshusername;

  grunt.log.ok("Started changing hosts file...");

  // Puts in host the nodes names and IP addresses
  utils.iterateOverClusterNodes(options, function (node, nextNode) {
    hosts.push(node.node.address + " " + node.node.name);
    return nextNode();
  }, function (err) {
    utils.dealWithError(err, done);

    // Adds hosts to the /etc/hosts of every node
    utils.iterateOverClusterNodes(options, function (node, next) {
      sshExec(node.node.address, username, "'echo \"" + hosts.join("\n")
        + "\" > /tmp/hosts && cat /etc/hosts >> /tmp/hosts'", function (err,
                                                                        stdout, stderr) {
        sshExec(node.node.address, username, "'sudo cp /tmp/hosts /etc/hosts'",
          function (err, stdout, stderr) {
            utils.dealWithError(err, function (err) {
            });
            grunt.log.ok("Done appending hosts to " + node.node.name);
            next();
          });

      });
    }, function (err) {
      utils.dealWithError(err, function (err) {
      });
      grunt.log.ok("Done appending hosts");
      done();
    });
  });

};

/**
 * Executes commands on selected nodetypes or single node
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.execnodes = function (grunt, options, done) {

  var username = options.pkgcloud.client.sshusername;

  grunt.log.ok("Started executing commands on nodes...");

  utils.iterateOverClusterNodes(options, function (node, nextNode) {
    if (!utils.isNodeToBeProcessed(grunt, node.node.type, node.node.id)) {
      return nextNode();
    }

    sshExec(node.node.address, username, "'" + grunt.option("command") + "'",
      function (err, stdout, stderr) {
        utils.dealWithError(err, function (err) {
        });
        grunt.log.ok("Done executing " + grunt.option.command + "  on "
          + node.node.name);
        nextNode();
      });

  }, function (err) {
    utils.dealWithError(err, done);
    done();
  });

};

/**
 * Executes a command on all Docker containers in the cluster.
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
module.exports.logs = function (grunt, options, done) {

  var execIterator = function (container, next) {
    if (!utils.isContainerToBeProcessed(grunt, container.node.node.type,
        container.node.node.id, container.container.Image.match(/\/(.+)\:/)
        && container.container.Image.match(/\/(.+)\:/)[1],
        container.container.Id)) {
      return next();
    }

    grunt.log.ok("Started logging on container "
      + container.container.Id + "  on node " + container.node.node.address);
    (new Docker(container.node.docker)).getContainer(container.container.Id)
      .logs({
        stdout: true,
        stderr: true,
        timestamps: true,
        follow: true
      }, function (err, stream) {
        utils.dealWithError(err, next);

        stream.on("data", function (chunk) {
          grunt.log.ok(String(chunk));
        });

        stream.on("end", function () {
          next();
        });
      });
  };

  grunt.log.ok("Started logging on containers");

  utils.iterateOverClusterContainers(grunt, options, execIterator,
    function (err) {
      utils.dealWithError(err, function (err) {
      });
      grunt.log.ok("Completed logging on containers");
      done();
    });

};

