'use strict';

module.exports = function() {
  // Sliding expiration of access tokens
  return function updateToken(req, res, next) {
    // get the accessToken from the request
    const token = req.accessToken;

    // if there's no token we use next() to delegate handling back to loopback
    if (!token) return next();

    const now = new Date();

    // EDIT: to make sure we don't use a token that's already expired, we don't update it
    // this line is not really needed, because the framework will catch invalid tokens already
    if (token.created.getTime() + (token.ttl * 1000) < now.getTime()) return next();

    // performance optimization, we do not update the token more often than once per day
    if (now.getTime() - token.created.getTime() < 86400000) return next();
    token.updateAttribute('created', now, next); // save to db and move on
  };
};
