'use strict';
require('cls-hooked');
require('dotenv').config();

var loopback = require('loopback');
var boot = require('loopback-boot');
var loopbackContext = require('loopback-context');
var app = module.exports = loopback();
var cookieParser = require('cookie-parser');
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
  var server = app.listen(function() {
    app.emit('started', server);
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
  var io = require('socket.io').listen(server);
  return server;
};

app.set('trust proxy', 'loopback');
app.middleware('auth', loopback.token());
app.use(cookieParser('test'));
app.get('/auth/passport/redirect', (req, res, next) => {
  // return if access_token is undefined
  if (!req.signedCookies.access_token) {
    res.redirect(app.get('frontend_url') + '/sign-in');
    return;
  }

  // get accessToken from db and set cookie
  app.models.AccessToken.findById(req.signedCookies.access_token, function(err, accessToken) {
    if (!accessToken) {
      res.redirect(app.get('frontend_url') + '/sign-in');
      return;
    }

    // check role of current user
    app.models.RoleMapping.find({where: {principalId: accessToken.userId}}, function(err, role) {
      if (err || !role[0]) {
        res.redirect(app.get('frontend_url') + '/sign-in');
        return;
      }
      if (role[0].roleId === 1) {
        res.redirect(app.get('frontend_url') + '/sign-in?social-sign-in-error=user-blocked');
        return;
      }

      // set access_token and userId cookies
      const expireDate = Date.parse(accessToken.created) + (accessToken.ttl * 1000);
      const currentDate = Date.parse(new Date(Date.now()));
      const ttl = (expireDate - currentDate) / 1000;

      res.header({
        'Set-Cookie': [
          'access_token=' + req.signedCookies.access_token + '; Max-Age=' + ttl + '; Path=/; Domain=' + app.get('domain') + ';',
          'userId=' + req.signedCookies.userId + '; Max-Age=' + ttl + '; Path=/; Domain=' + app.get('domain') + ';',
        ],
      });

      res.redirect(app.get('frontend_url'));
      return;
    });
  });
});

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
// Load the provider configurations
var config = {};
try {
  // get environment specific providers file
  switch (app.get('env')) {
    case 'development' :
      config = require('./providers.json');
      break;
    default:
      config = require('./providers.' + app.get('env') + '.json');
  }
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

/**
 *
 * Elastic Search
 *
 */
const {Client} = require('@elastic/elasticsearch');
global.es = new Client({
  node: app.get('elasticSearch_host'),
});
