'use strict';

var path = require('path');

module.exports = {
  plugins: {
    appOpworker: {
      rpcWorkers: {
        "example": {
          connection: {
            uri: process.env.DEVEBOT_OPFLOW_URI || 'amqp://localhost',
            exchangeName: 'app-opworker-exchange',
            routingKey: 'app-opworker-example',
            operatorName: 'app-opworker-example-operator',
            responseName: 'app-opworker-example-response',
            applicationId: 'AppOpworkerExample',
            autoinit: false
          },
          mappings: {
            'fibonacci': {
              service: 'application/example',
              methodName: 'fibonacci'
            }
          }
        }
      }
    }
  }
};
