'use strict';

module.exports = function(Useridentity) {
  Useridentity.observe('after save', async function(ctx, next) {
    console.log(ctx['instance']['id']);

    let user;
    let userIdentity;

    switch (ctx['instance']['provider']) {
      case 'facebook':
        // get userIdentity
        try {
          userIdentity = await Useridentity.find({where: {userId: ctx['instance']['userId']}});
        } catch (e) {
          console.log(e);
          next();
        }

        const userIdentityProfile = userIdentity[0]['profile'];
        user = {
          id: ctx['instance']['userId'],
          firstName: userIdentityProfile['name']['givenName'],
          lastName: userIdentityProfile['name']['familyName'],
          email: userIdentityProfile['emails'][0]['value'],
          picture: userIdentityProfile['photos'][0]['value'],
          emailVerified: 1,
        };
        break;
      case 'google':
        console.log('google');
        break;
      default:
        console.log('default');
        break;
    }

    Useridentity.app.models.UserFull.upsert(user, function(err, result) {
      if (err) {
        console.log(err);
      }
    });

    next();
  });
};
