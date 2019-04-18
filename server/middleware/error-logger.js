'use strict';

module.exports = function(options) {
  return function logError(err, req, res, next) {
    console.log('unhandled error', err);
    next(err);
    // return err;
    // next(res.status(err.status));
  };
};
