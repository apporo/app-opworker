'use strict';

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash')
var opflow = require('opflow');
var Propagator = require('../utils/propagator');

var Service = function(params) {
  params = params || {};
  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + constructor begin ...'
  }));

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});

  var _rpcWorkers = {};

  var init = function() {
    if (pluginCfg.enabled === false) return;
    lodash.forOwn(pluginCfg.rpcWorkers, function(rpcInfo, rpcName) {
      if (rpcInfo && lodash.isObject(rpcInfo.connection) && 
          !lodash.isEmpty(rpcInfo.connection) && rpcInfo.enabled != false) {
        var rpcWorker = new opflow.RpcWorker(rpcInfo.connection);
        var rpcBinder = new Propagator({ LX, LT, rpcWorker });
        _rpcWorkers[rpcName] = {
          binder: rpcBinder,
          worker: rpcWorker
        }
        if (lodash.isObject(rpcInfo.mappings)) {
          lodash.forOwn(rpcInfo.mappings, function(routineDef, routineId) {
            LX.has('silly') && LX.log('silly', LT.add({
              rpcName: rpcName,
              routineId: routineId
            }).toMessage({
              text: ' - define routine[${routineId}] in RpcWorker[${rpcName}]'
            }));
            if (lodash.isString(routineDef.service)) {
              var service = params.sandboxRegistry.lookupService(routineDef.service);
              var methodName = routineDef.methodName || routineId;
              LX.has('silly') && LX.log('silly', LT.add({
                routineId: routineId,
                serviceName: service,
                methodName: methodName
              }).toMessage({
                text: ' - map routine[${routineId}] to method [${serviceName}.${methodName}]'
              }));
              if (lodash.isObject(service)) {
                rpcBinder.registerRoutine({
                  routineId: routineId,
                  handler: service[methodName],
                  context: service
                });
              }
            }
          })
        }
      }
    });
  }

  self.get = function(rpcName) {
    return _rpcWorkers[rpcName];
  }

  self.start = function() {
    return Promise.mapSeries(lodash.values(_rpcWorkers), function(coupling) {
      return coupling.worker.ready().then(coupling.binder.process);
    });
  };

  self.stop = function() {
    return Promise.mapSeries(lodash.values(_rpcWorkers), function(coupling) {
      return coupling.worker.close();
    });
  };

  init();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

Service.referenceList = [ 'sandboxRegistry' ];

module.exports = Service;
