'use strict';

const LoopBackContext = require('loopback-context');
const app = require('./../../server/server');

module.exports = function(Useridentity) {
  Useridentity.observe('before save', async function(ctx, next) {
    // get res from current context
    const currentCtx = LoopBackContext.getCurrentContext();
    const res = (currentCtx && currentCtx.get('http'))['res'];

    // check if a user with this email already exists
    const user = await Useridentity.app.models.UserFull.find({where: {email: ctx['instance']['profile']['emails'][0]['value']}});

    // stop if email already exists
    if (user.length > 0) {
      // delete passports created user
      console.log(user);
      await Useridentity.app.models.UserFull.deleteById(ctx['instance']['userId'])
        .then(data => console.log('data', data))
        .catch(err => console.error('err', err));

      // redirect to error page
      res.redirect(app.get('frontend_url') + '/sign-in?social-sign-in-error=email-exists');

      // throw error
      const error = new Error();
      error.statusCode = 422;
      error.name = 'ValidationError';
      error.message = 'Email already exists';
      error.details = [
        {
          messages: {
            email: [
              'This email has already been used to create another account. You can link your social accounts in your profile settings.',
              'is not unique',
            ],
          },
        },
      ];
      next(error);
    }

    next();
  });

  Useridentity.observe('after save', async function(ctx, next) {
    // get res from current context
    const currentCtx = LoopBackContext.getCurrentContext();
    const res = (currentCtx && currentCtx.get('http'))['res'];

    let user;
    let userIdentity;
    let userIdentityProfile;

    // get userIdentity
    try {
      userIdentity = await Useridentity.find({where: {userId: ctx['instance']['userId']}});
    } catch (e) {
      console.log(e);
      next();
    }

    // create user object
    userIdentityProfile = userIdentity[0]['profile'];
    user = {
      id: ctx['instance']['userId'],
      firstName: userIdentityProfile['name']['givenName'],
      lastName: userIdentityProfile['name']['familyName'],
      email: userIdentityProfile['emails'][0]['value'],
      picture: userIdentityProfile['photos'][0]['value'],
      emailVerified: 1,
    };

    // change user object with social profile information
    Useridentity.app.models.UserFull.upsert(user, {preserveAccessTokens: true}, function(err, result) {
      if (err) {
        console.log(err);
      }
    });

    // set cookie
    res.cookie('name', 'value', {signed: true});
    res.setHeader('Set-Cookie', 'name=value;domain=.beerless.be');

    next();
  });
};
