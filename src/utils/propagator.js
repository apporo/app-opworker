'use strict';

const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const logolite = Devebot.require('logolite');
const LogTracer = logolite.LogTracer;

function Propagator(params) {
  let {packageName, rpcWorker, LX, LT} = params;
  let routineIds = [];
  let routineDef = {};

  let propagatorId = params.propagatorId || LogTracer.getLogID();
  let propagatorTrail = LT.branch({ key:'propagatorId', value:propagatorId });

  let blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('info') && LX.log('info', propagatorTrail.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: 'Propagator.new()'
  }));

  let processor = function(body, headers, response) {
    let routineId = getRoutineId(headers);
    let routineTrail = propagatorTrail.branch({ key:'routineId', value:routineId });
    let routine = routineDef[routineId];
    if (!routine) return Promise.resolve('next');
    let requestId = getRequestId(headers);
    let reqTr = routineTrail.branch({ key:'requestId', value:requestId });
    return Promise.resolve().then(function() {
      response.emitStarted();
      let args = JSON.parse(body);
      args = lodash.isArray(args) ? args : [ args ];
      args.push({ requestId: requestId });
      return routine.handler.apply(routine.context, args);
    }).then(function(output) {
      response.emitCompleted(output);
      LX.has('info') && LX.log('info', reqTr.toMessage({
        text: 'processor() has completed successfully'
      }));
      return Promise.resolve('done');
    }).catch(function(error) {
      error = error || {};
      response.emitFailed({
        code: error.code,
        message: error.message,
        errorClass: error.name,
        errorStack: error.stack
      });
      LX.has('info') && LX.log('info', reqTr.toMessage({
        text: 'processor() has failed'
      }));
      return Promise.resolve('done');
    }).finally(function() {
      LX.has('info') && LX.log('info', reqTr.toMessage({
        text: 'processor() has finished'
      }));
    })
  }

  this.process = function() {
    return rpcWorker.process(routineIds, processor);
  }

  this.registerRoutine = function(descriptor) {
    // TODO: validate descriptor here
    descriptor = descriptor || {};
    let routineId = descriptor.routineId || descriptor.signature || descriptor.name;
    routineIds.push(routineId);
    routineDef[routineId] = {
      schema: descriptor.schema,
      handler: descriptor.handler,
      context: descriptor.context
    }
    return this;
  }

  this.rpcWorker = rpcWorker;

  LX.has('info') && LX.log('info', propagatorTrail.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: 'Propagator.new() end!'
  }));
}

module.exports = Propagator;

let getHeaderField = function(headers, fieldName, uuidIfNotFound, defVal) {
  if (headers == null || headers[fieldName] == null) {
    return (uuidIfNotFound) ? LogTracer.getLogID() : defVal;
  }
  return headers[fieldName];
}

let getRequestId = function(headers, uuidIfNotFound) {
  if (typeof(uuidIfNotFound) == 'undefined') uuidIfNotFound = true;
  return getHeaderField(headers, 'requestId', uuidIfNotFound);
}

let getRoutineId = function(headers, uuidIfNotFound) {
  if (typeof(uuidIfNotFound) == 'undefined') uuidIfNotFound = false;
  return getHeaderField(headers, 'routineId', uuidIfNotFound);
}
