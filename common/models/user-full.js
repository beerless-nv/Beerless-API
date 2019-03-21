'use strict';

// const LoopBackContext = require('loopback-context');
module.exports = function(Userfull) {
  /**
   * Validation
   */
  // Userfull.validatesPresenceOf('favouriteBeerId');
  Userfull.validatesUniquenessOf('username', 'email');
  Userfull.validatesNumericalityOf('emailVerified', 'totalPoints', 'favouriteBeerId');

  /**
   * get user function
   *
   * Makes sure there is no personal and restricted info in the response.
   *
   * @param data
   * @returns {Promise<void>}
   */

  Userfull.get = async function(data) {
    if (data != null) {
      let user = await Userfull.findById(data);

      user.email = null;
      user.emailVerified = null;

      return user;
    }
  };

  Userfull.remoteMethod('get', {
    accepts: {
      arg: 'data',
      type: 'number',
      required: true,
    },
    returns: {type: 'object', root: true},
    http: {path: '/get', verb: 'get'},
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
   * Extending user create method.
   *
   * This method gives new users a standard user role by adding a RoleMapping
   * entry to the database.
   */

  Userfull.afterRemote('create', async function(ctx, modelInstance, next) {
    // const ctx = LoopBackContext.getCurrentContext();

    console.log(ctx.result.id);

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
