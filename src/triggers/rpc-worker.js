'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const opflow = require('opflow');
const Propagator = require('../utils/propagator');

function RpcWorker(params) {
  params = params || {};
  let self = this;

  let LX = params.loggingFactory.getLogger();
  let LT = params.loggingFactory.getTracer();
  let packageName = params.packageName || 'app-opmaster';
  let blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor begin ...'
  }));

  let pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  let sandboxRegistry = params["devebot/sandboxRegistry"];

  let _rpcWorkers = {};

  let init = function() {
    if (pluginCfg.enabled === false) return;
    lodash.forOwn(pluginCfg.rpcWorkers, function(rpcInfo, rpcName) {
      if (rpcInfo && lodash.isObject(rpcInfo.connection) && 
          !lodash.isEmpty(rpcInfo.connection) && rpcInfo.enabled != false) {
        let rpcWorker = new opflow.RpcWorker(rpcInfo.connection);
        let rpcBinder = new Propagator({ packageName, LX, LT, rpcWorker });
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
              let service = sandboxRegistry.lookupService(routineDef.service);
              let methodName = routineDef.methodName || routineId;
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
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

RpcWorker.referenceList = [ "devebot/sandboxRegistry" ];

module.exports = RpcWorker;
