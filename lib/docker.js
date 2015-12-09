/**
 * OpenAPI tasks to automate Docker
 */

var commands = {};
var Docker = require("dockerode"), _ = require("underscore"), utils = require("../lib/utils"), querystring = require("querystring");

/**
 * Pulls the Docker images from a registry for all the servers the servers
 * defined in Grunt and present in the cluster
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
 *          done Callback to call when the requests are completed
 */
commands.pull = function(grunt, pkgcloudClientOptions, dockerClientOptions,
    options, done) {

  grunt.log.ok("Started pulling images...");

  // Pulls all the images for all the servers defined in options and present in
  // the cluster
  var pullIterator = function(pull, next) {

    grunt.log.ok("Started pulling image " + pull.image + " from server "
        + pull.server.name);

    (new Docker(pull.docker)).pull(pull.repo, pull, function(err, stream) {
      if (err) {
        return next(err);
      }

      stream.setEncoding("utf8");
      stream.on("error", next);
      stream.on("data", function(data) {
        var jsonData = JSON.parse(data);
        if (jsonData && jsonData.error) {
          stream.emit("error", jsonData.error);
        }
      });
      stream.on("end", function() {
        grunt.log.ok("Done pulling image " + pull.image + " from server "
            + pull.server.name);
        next();
      });

    }, pull.auth);

  };
  var doneIterator = function(err) {
    if (err) {
      done(err);
    }
    grunt.log.ok("Done pulling images.");
    done();
  };

  utils.iterateOverServers(utils.getComputeClient(pkgcloudClientOptions), utils
      .getDefinedServers(options.servernamingfunction, options.servertypes),
      dockerClientOptions, options.servertypefunction, pullIterator,
      doneIterator);
};

/**
 * Issues the Docker run command for the Docker images from a registry for all
 * the servers the servers defined in Grunt and present in the cluster
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
 *          done Callback to call when the requests are completed
 */
commands.run = function(grunt, pkgcloudClientOptions, dockerClientOptions,
    options, done) {

  grunt.log.ok("Started creating containers...");
  var optServers = utils.getDefinedServers(options.servernamingfunction,
      options.servertypes);

  // As a courtesy to the server, the /etc/hosts is update with the
  // names and addresses of the servers in the cluster
  utils
      .getComputeClient(pkgcloudClientOptions)
      .getServers(
          {},
          function(err, servers) {

            // Selects only the servers that have their names defined in
            // optServers
            var selServers = _.filter(servers, function(server) {
              if (_.pluck(optServers, "name").indexOf(server.name) >= 0) {
                return true
              }
            });

            // Puts in the hosts property of optServers the addresses of all the
            // servers in the cluster in a format suitaBle for the ExtraHosts
            // property of the DOcker create command options
            optServers.hosts = _.map(selServers, function(server) {
              return server.name + ":" + server.addresses.public[0];
            });

            // Runs all the images for all the servers defined in options and
            // present in
            // the cluster
            var runIterator = function(run, next) {

              grunt.log.ok("Started creating container from image " + run.image
                  + " on server " + run.server.name);

              // Adds the server addresses the the start options
              var createOptions = _.clone(run.run.create);
              createOptions.HostConfig = (createOptions.HostConfig) ? createOptions.HostConfig
                  : {};
              createOptions.HostConfig.ExtraHosts = optServers.hosts;
              var streamo = (new Docker(run.docker)).run(run.repo, run.run.cmd,
                  null, createOptions, run.run.start, function(err, data,
                      container) {
                    if (err) {
                      grunt.log.error("Error creating container from image "
                          + run.image + " on server " + run.server.name);
                      grunt.log.error(err);
                      next(err);
                    }
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
                    + " from image " + run.image + " on server "
                    + run.server.name);
                streamo.emit("end");
              });

              streamo.on("end", function() {
                next();
              });

            };
            var doneIterator = function(err) {
              if (err) {
                done(err);
              } else {
                grunt.log.ok("Done creating containers.");
                done();
              }
            };

            utils.iterateOverServers(utils
                .getComputeClient(pkgcloudClientOptions), optServers,
                dockerClientOptions, options.servertypefunction, runIterator,
                doneIterator);
          });

};

/**
 * Tests all the containers in the cluster
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
 *          done Callback to call when the requests are completed
 */
commands.test = function(grunt, pkgcloudClientOptions, dockerClientOptions,
    options, done) {

  grunt.log.ok("Started testing containers...");

  // Tests all the containers for all the servers defined in options and present
  // in the cluster
  var testIterator = function(test, next) {

    if (!test.test) {
      return next();
    }

    var ntests = test.test.length;

    test.test.forEach(function(testcase) {
      var http = (testcase.protocol === "http") ? require("http")
          : require("https");
      var auth = (testcase.auth) ? testcase.auth + "@" : null;
      console.log("http://" + auth + test.server.address + ":" + testcase.port
          + "/" + testcase.path + "?" + querystring.stringify(testcase.query)); // XXX
      http.get({
        host : test.server.address,
        auth : testcase.auth,
        port : testcase.port,
        path : testcase.path + "?" + querystring.stringify(testcase.query)
      }, function(res) {
        var body = "";
        res.on("data", function(data) {
          body += data;
        });
        res.on("error", function(err) {
          grunt.log.error("Error testing image " + test.image + " from server "
              + test.server.name);
          grunt.log.error(err);
          if (--ntests === 0) {
            next();
          }
        });
        res.on("end", function() {
          if (body.indexOf(testcase.shouldStartWith) > -1) {
            grunt.log.ok("Successfuly done testing image " + test.image
                + " from server " + test.server.name);
          } else {
            grunt.log.error("Incorrect result testing image " + test.image
                + " from server " + test.server.name);
            grunt.log.error(body);
          }
          if (--ntests === 0) {
            next();
          }
        });
      });
    });
  };
  var doneIterator = function(err) {
    if (err) {
      done(err);
    } else {
      done();
    }
  };

  utils.iterateOverServers(utils.getComputeClient(pkgcloudClientOptions), utils
      .getDefinedServers(options.servernamingfunction, options.servertypes),
      dockerClientOptions, options.servertypefunction, testIterator,
      doneIterator);
};

/**
 * Stops and removes the containers in the cluster
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
 *          done Callback to call when the requests are completed
 */
commands.remove = function(grunt, pkgcloudClientOptions, dockerClientOptions,
    options, done) {

  grunt.log.ok("Started removing containers...");
  var optServers = utils.getDefinedServers(options.servernamingfunction,
      options.servertypes);

  // Removes all the containers for all the servers defined in options and
  // present in the cluster As a courtesy to the server, the /etc/hosts is
  // update with the names and addresses of the servers in the cluster
  utils.getComputeClient(pkgcloudClientOptions).getServers(
      {},
      function(err, servers) {

        // Selects only the servers that have their names defined in
        // optServers
        var selServers = _.filter(servers, function(server) {
          if (_.pluck(optServers, "name").indexOf(server.name) >= 0) {
            return true
          }
        });

        // Removes all the containers for all the servers defined in options
        // and
        // present in the cluster
        var removeIterator = function(remove, next) {

          grunt.log.ok("Started removing container from server "
              + remove.server.name);

          (new Docker(remove.docker)).listContainers(function(err, containers) {
            if (err) {
              grunt.log.error("Error removing containers from server "
                  + remove.server.name);
              grunt.log.error(err);
              next(err);
            } else {
              var nremoves = containers.length;

              if (nremoves === 0) {
                next();
              }

              containers.forEach(function(container) {
                (new Docker(remove.docker)).getContainer(container.Id).stop(
                    {},
                    function(err, data) {

                      if (err) {
                        grunt.log
                            .error("Error stopping container " + container.Id
                                + " on server " + remove.server.name);
                        grunt.log.error(err);
                      }

                      (new Docker(remove.docker)).getContainer(container.Id)
                          .remove(
                              {},
                              function(err, data) {
                                if (err) {
                                  grunt.log.error("Error removing container "
                                      + container.Id + " on server "
                                      + remove.server.name);
                                  grunt.log.error(err);
                                } else {
                                  grunt.log.ok("Removed container "
                                      + container.Id + " on server "
                                      + remove.server.name);
                                }

                                if (--nremoves === 0) {
                                  next();
                                }
                              })
                    })
              });
            }
          });
        };
        var doneIterator = function(err) {
          if (err) {
            done(err);
          } else {
            grunt.log.ok("Done removing containers.");
            done();
          }
        };

        utils.iterateOverServers(utils.getComputeClient(pkgcloudClientOptions),
            optServers, dockerClientOptions, options.servertypefunction,
            removeIterator, doneIterator);
      });

};

module.exports = commands;
