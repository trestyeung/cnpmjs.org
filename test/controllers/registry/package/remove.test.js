/**!
 * cnpmjs.org - test/controllers/registry/package/remove.test.js
 *
 * Copyright(c) cnpmjs.org and other contributors.
 * MIT Licensed
 *
 * Authors:
 *  fengmk2 <fengmk2@gmail.com> (http://fengmk2.github.com)
 */

'use strict';

/**
 * Module dependencies.
 */

var should = require('should');
var request = require('supertest');
var mm = require('mm');
var app = require('../../../../servers/registry');
var utils = require('../../../utils');
var config = require('../../../../config');
var packageService = require('../../../../services/package');
var nfs = require('../../../../common/nfs');

describe('controllers/registry/package/remove.test.js', function () {
  afterEach(mm.restore);

  before(function (done) {
    var pkg = utils.getPackage('@cnpmtest/testmodule-remove-1', '1.0.0', utils.admin);
    request(app.listen())
    .put('/' + pkg.name)
    .set('authorization', utils.adminAuth)
    .send(pkg)
    .expect(201, done);
  });

  it('should delete 401 when no auth', function (done) {
    request(app)
    .del('/@cnpmtest/testmodule-remove-1/-rev/1')
    .expect({
      error: 'unauthorized',
      reason: 'Login first'
    })
    .expect(401, done);
  });

  it('should 404 when package not exists', function (done) {
    request(app)
    .del('/@cnpmtest/testmodule-remove-1-not-exists/-rev/1')
    .set('authorization', utils.adminAuth)
    .expect({
      error: 'not_found',
      reason: 'document not found'
    })
    .expect(404, done);
  });

  it('should delete 403 when user is not admin on config.enablePrivate = true', function (done) {
    mm(config, 'enablePrivate', true);
    request(app)
    .del('/@cnpmtest/testmodule-remove-1/-rev/1')
    .set('authorization', utils.otherUserAuth)
    .expect({
      error: 'no_perms',
      reason: 'Private mode enable, only admin can publish this module'
    })
    .expect(403, done);
  });

  it('should 400 when scope not exists', function (done) {
    request(app)
    .del('/@cnpm-not-exists/testmodule-remove-1/-rev/1')
    .set('authorization', utils.otherUserAuth)
    .expect({
      error: 'invalid scope',
      reason: 'scope @cnpm-not-exists not match legal scopes: @cnpm, @cnpmtest'
    })
    .expect(400, done);
  });

  it('should 403 when delete non scoped package', function (done) {
    request(app)
    .del('/testmodule-remove-1/-rev/1')
    .set('authorization', utils.otherUserAuth)
    .expect({
      error: 'no_perms',
      reason: 'only allow publish with @cnpm, @cnpmtest scope(s)'
    })
    .expect(403, done);
  });

  it('should 403 when user not maintainer', function (done) {
    request(app)
    .del('/@cnpmtest/testmodule-remove-1/-rev/1')
    .set('authorization', utils.otherUserAuth)
    .expect({
      error: 'forbidden user',
      reason: 'cnpmjstest101 not authorized to modify @cnpmtest/testmodule-remove-1'
    })
    .expect(403, done);
  });

  it('should remove all versions ok', function (done) {
    request(app)
    .del('/@cnpmtest/testmodule-remove-1/-rev/1')
    .set('authorization', utils.adminAuth)
    .expect(200, function (err) {
      should.not.exist(err);
      request(app)
      .get('/@cnpmtest/testmodule-remove-1')
      .expect(404, done);
    });
  });

  describe('mock error', function () {
    beforeEach(function (done) {
      var pkg = utils.getPackage('@cnpmtest/testmodule-remove-mock-1', '2.0.0', utils.admin);
      request(app.listen())
      .put('/' + pkg.name)
      .set('authorization', utils.adminAuth)
      .send(pkg)
      .expect(201, done);
    });

    it('should mock key not exists', function (done) {
      var listModulesByName = packageService.listModulesByName;
      mm(packageService, 'listModulesByName', function* (name) {
        var mods = yield* listModulesByName.call(packageService, name);
        mods.forEach(function (mod) {
          delete mod.package.dist.key;
        });
        return mods;
      });
      request(app)
      .del('/@cnpmtest/testmodule-remove-mock-1/-rev/1')
      .set('authorization', utils.adminAuth)
      .expect(200, function (err) {
        should.not.exist(err);
        request(app)
        .get('/@cnpmtest/testmodule-remove-mock-1')
        .expect(404, done);
      });
    });

    it('should mock nfs remove error', function (done) {
      mm(nfs, 'remove', function* () {
        throw new Error('mock nfs remove error');
      });
      request(app)
      .del('/@cnpmtest/testmodule-remove-mock-1/-rev/1')
      .set('authorization', utils.adminAuth)
      .expect(200, function (err) {
        should.not.exist(err);
        request(app)
        .get('/@cnpmtest/testmodule-remove-mock-1')
        .expect(404, done);
      });
    });
  });
});
