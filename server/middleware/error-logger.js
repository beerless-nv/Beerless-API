'use strict';

module.exports = function() {
  return function logError(err, req, res, next) {
    next(err);
  };
};
