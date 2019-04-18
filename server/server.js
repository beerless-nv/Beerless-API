'use strict';
require('cls-hooked');
require('dotenv').config();

var loopback = require('loopback');
var boot = require('loopback-boot');
var loopbackContext = require('loopback-context');

var app = module.exports = loopback();

// user context
app.use(loopback.token());
app.use(function(req, res, next) {
  if (!req.accessToken) return next();
  app.models.UserFull.findById(req.accessToken.userId, function(err, user) {
    if (err) return next(err);
    if (!user) return next(new Error('No user with this access token was found.'));
    res.locals.currentUser = user;
    var loopbackCtx = loopbackContext.getCurrentContext();
    if (loopbackCtx) loopbackCtx.set('currentUser', user);
    next();
  });
});

// access token
app.use(loopback.token({
  cookies: ['access_token'],
  headers: ['access_token', 'X-Access-Token'],
  params: ['access_token'],
}));

app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module) {  // if we are running loopback as our server
    app.use(loopback.token({}));

    //
    // Sliding expiration of access tokens
    //
    app.use(function updateToken(req, res, next) {
      var token = req.accessToken; // get the accessToken from the request
      if (!token) return next(); // if there's no token we use next() to delegate handling back to loopback
      var now = new Date();
      // EDIT: to make sure we don't use a token that's already expired, we don't update it
      // this line is not really needed, because the framework will catch invalid tokens already
      if (token.created.getTime() + (token.ttl * 1000) < now.getTime()) return next();
      // performance optimization, we do not update the token more often than once per day
      if (now.getTime() - token.created.getTime() < 86400000) return next();
      token.updateAttribute('created', now, next); // save to db and move on
    });
    app.start();
  }
});
