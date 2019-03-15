'use strict';
require('cls-hooked');

var loopback = require('loopback');
var boot = require('loopback-boot');
var loopbackContext = require('loopback-context');

var app = module.exports = loopback();

// user context
app.use(loopback.token());
app.use(function (req, res, next) {
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
  if (require.main === module)
    app.start();
});
