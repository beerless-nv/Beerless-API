'use strict';

const LoopBackContext = require('loopback-context');

module.exports = function(Userfull) {
  /**
   * Validation
   */
  // Userfull.validatesPresenceOf('favouriteBeerId');
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
   * getAll users function
   *
   * Makes sure there is no personal and restricted info in the response.
   *
   * @returns {Promise<void>}
   */
  Userfull.getAll = async function() {
    let users = await Userfull.find();

    users.forEach(function(user) {
      user.email = null;
      user.emailVerified = null;
    });

    return users;
  };

  Userfull.remoteMethod('getAll', {
    returns: {type: 'object', root: true},
    http: {path: '/getAll', verb: 'get'},
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
    const userId = ctx.result.id;

    const roleMappingObject = {
      'principalType': 'USER',
      'principalId': userId,
      'roleId': 1,
    };

    Userfull.app.models.RoleMapping.create(roleMappingObject);

    return userId;
  });
};
