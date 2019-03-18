'use strict';

// const LoopBackContext = require('loopback-context');
module.exports = function(Userfull) {
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
