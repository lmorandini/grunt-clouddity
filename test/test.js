const grunt = require('grunt');
const _ = require('underscore');
const path = require('path');
const testDir = path.join(process.cwd(), 'test');
const opts = {gruntfile: path.join(testDir, 'Gruntfile.js')};
const fs = require('fs');
const should = require('chai').should();

describe('OpenStack commands', function () {

  before(function (done) {
    done();
  });

  it('Read-only commands', function (done) {

    grunt.tasks(['exec:version'], opts, function (err, stdout, stderr) {
      _.isUndefined(err).should.equal.true;
      done();
    });
  });

  after(function (done) {
    done();
  });

});
