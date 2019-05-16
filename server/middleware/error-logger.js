'use strict';

module.exports = function() {
  return function logError(err, req, res, next) {
    console.log('unhandled error', err);
    next(err);
  };
};
