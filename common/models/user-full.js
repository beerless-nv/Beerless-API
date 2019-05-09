'use strict';

const LoopBackContext = require('loopback-context');
require('custom-env').env(true);
const app = require('./../../server/server');
var sendgrid = require('@sendgrid/mail');
const uuidv1 = require('uuid/v1');

module.exports = function(Userfull) {
  /**
   * Validation
   */
  Userfull.validatesUniquenessOf('username', 'email');
  Userfull.validatesNumericalityOf('emailVerified', 'totalPoints', 'favouriteBeerId');

  /**
   * Returns logged in user
   *
   * @param data
   * @returns {Promise<void>}
   */
  Userfull.getLoggedUser = async function(req) {
    if (req.accessToken) {
      return Userfull.findById(req.accessToken.userId);
    }
  };

  Userfull.remoteMethod('getLoggedUser', {
    accepts: [
      {arg: 'req', type: 'object', 'http': {source: 'req'}},
    ],
    returns: {type: 'object', root: true},
    http: {path: '/getLoggedUser', verb: 'get'},
  });

  /**
   * Check if accessToken of current user is still valid.
   * Remove accessToken if not.
   *
   * @param req
   * @returns {Promise<void>}
   */
  Userfull.checkToken = async function(token) {
    if (!token) {
      return false;
    }

    const accessToken = await Userfull.app.models.AccessToken.findById(token.accessToken);

    if (accessToken) {
      const expireDate = Date.parse(accessToken.created) + (accessToken.ttl * 1000);
      if (expireDate < Date.now()) {
        Userfull.app.models.AccessToken.deleteById(accessToken.id);
        return false;
      }
      return true;
    }

    return false;
  };

  Userfull.remoteMethod('checkToken', {
    accepts: [
      {arg: 'token', type: 'object', root: true},
    ],
    returns: {type: 'boolean', root: true},
    http: {path: '/checkToken', verb: 'get'},
  });

  /**
   * Returns the role of the current user.
   *
   * @returns {Promise<void>}
   */
  Userfull.getRole = async function(req) {
    if (!req.accessToken.id) {
      return '$everyone';
    }

    const roleId = (await Userfull.app.models.RoleMapping.find({where: {principalId: req.accessToken.userId}}))[0]['roleId'];

    return await Userfull.app.models.Role.findById(roleId, {
      fields: {
        id: true,
        name: true,
      },
    });
  };

  Userfull.remoteMethod('getRole', {
    accepts: [
      {arg: 'req', type: 'object', 'http': {source: 'req'}},
    ],
    returns: {type: 'string', root: true},
    http: {path: '/getRole', verb: 'get'},
  });

  /**
   * Extending user create method.
   *
   * This method gives new users a standard user role by adding a RoleMapping
   * entry to the database.
   */
  Userfull.afterRemote('create', async function(ctx, modelInstance, next) {
    ctx.result.verificationToken = uuidv1();

    const user = await Userfull.upsert(ctx.result, function(result, err) {
      console.log('result', result);
      Userfull.sendVerificationEmail(ctx.result.id);
      if (err) {
        return err;
      }
    });



    // user role is blocked by default (roleId: 1) before release
    const roleMappingObject = {
      'principalType': 'USER',
      'principalId': ctx.result.id,
      'roleId': 1,
    };

    Userfull.app.models.RoleMapping.create(roleMappingObject);

    return ctx.result.id;
  });

  /**
   * Send verification email to registered user.
   *
   * @param userId
   * @returns {Promise<void>}
   */
  Userfull.sendVerificationEmail = async function(userId) {
    // get user
    const user = await Userfull.findById(userId);

    sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

    const email = {
      to: {
        email: user.email,
      },
      dynamic_template_data: {
        'Sender_Name': 'Beerless',
        'Sender_Address': 'Kempische Steenweg 293',
        'Sender_City': 'Hasselt',
        'Sender_Zip': '3500',
        'Sender_Country': 'Belgium',
        'To_FirstName': user.firstName,
        'To_LastName': user.lastName,
        'Verify_Link': app.get('frontend_url') + '/sign-up/confirm?uid=' + user.id + '&token=' + user.verificationToken,
      },
      from: {
        name: 'Beerless',
        email: process.env.NOREPLY_EMAIL,
      },
      subject: 'Registration to Beerless',
      text: 'Registration',
      templateId: 'd-fb34204de2a34eb29cacd385b57433d0',
    };

    sendgrid.send(email);
  };

  Userfull.remoteMethod('sendVerificationEmail', {
    accepts: [
      {arg: 'userId', type: 'string', required: true},
    ],
    // returns: {type: 'boolean', root: true},
    http: {path: '/sendVerificationEmail', verb: 'get'},
  });

  Userfull.on('resetPasswordRequest', function(info) {
    sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

    const email = {
      to: {
        email: info.email,
      },
      dynamic_template_data: {
        'Sender_Name': 'Beerless',
        'Sender_Address': 'Kempische Steenweg 293',
        'Sender_City': 'Hasselt',
        'Sender_Zip': '3500',
        'Sender_Country': 'Belgium',
        'Reset_Link': app.get('frontend_url') + '/reset/' + info.accessToken.id,
      },
      from: {
        name: 'Beerless',
        email: process.env.NOREPLY_EMAIL,
      },
      subject: 'Reset password',
      text: 'Forgotton your password?',
      templateId: 'd-90ffb0ec5d204eb0a44243a7d3887268',
    };

    sendgrid.send(email);
  });

  Userfull.afterRemote('login', async function(info) {
    // get all accessTokens from current user
    const accessTokens = await Userfull.app.models.AccessToken.find({where: {userId: info.userId}});

    // delete accessTokens which are expired
    accessTokens.map(accessToken => {
      const expireDate = Date.parse(accessToken.created) + (accessToken.ttl * 1000);
      if (expireDate < Date.now()) {
        Userfull.app.models.AccessToken.deleteById(accessToken.id);
      }
    });
  });

};
