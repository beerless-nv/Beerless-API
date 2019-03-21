'use strict';

module.exports = function(Model, options) {
  // Model is the model class
  // options is an object containing the config properties from model definition
  Model.defineProperty('timestampCreated', {type: Date, default: Date.now()});
  Model.defineProperty('timestampUpdated', {type: Date, default: Date.now()});
};
