'use strict';
require('cls-hooked');
require('dotenv').config();

var loopback = require('loopback');
var boot = require('loopback-boot');
var loopbackContext = require('loopback-context');
var app = module.exports = loopback();
// var session = require('express-session');
// Passport configurators
var PassportConfigurator = require('loopback-component-passport').PassportConfigurator;
var passportConfigurator = new PassportConfigurator(app);

/**
 *
 * user context
 *
 */
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

/**
 *
 * access_token
 *
 */
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
    app.start();
  }
});

/**
 *
 * providers.json file for social login
 *
 */
// Enable http session
// app.use(loopback.session({secret: 'keyboard cat'}));

// Load the provider configurations
var config = {};
try {
  config = require('./providers.json');
} catch (err) {
  console.error('Please configure your passport strategy in `providers.json`.');
  console.error('Copy `providers.json.template` to `providers.json` and replace the clientID/clientSecret values with your own.');
  process.exit(1);
}
// Initialize passport
passportConfigurator.init();

// Set up related models
passportConfigurator.setupModels({
  userModel: app.models.UserFull,
  userIdentityModel: app.models.userIdentity,
  userCredentialModel: app.models.userCredential,
});
// Configure passport strategies for third party auth providers
for (var s in config) {
  var c = config[s];
  c.session = c.session !== false;
  passportConfigurator.configureProvider(s, c);
}
