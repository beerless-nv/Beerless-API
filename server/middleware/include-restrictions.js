'use strict';

var loopbackContext = require('loopback-context');

module.exports = function() {
  return function restrict(req, res, next) {
    // if no filters, function stops
    if (!req.query.filter) {
      next();
      return;
    }

    next();
  };
};
