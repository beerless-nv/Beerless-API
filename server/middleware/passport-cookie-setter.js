'use strict';

module.exports = function() {
  // Sliding expiration of access tokens
  return function cookieSetter(req, res, next) {
    next();
  };
};
