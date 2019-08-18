'use strict';

const deleteKey = require('object-delete-key');

/**
 * This mixin checks which type of user is trying to access the other user's information.
 * Only the administrator has access to the full user profile, which includes the user's private information (email).
 * Every other user role is restricted to the user profile without private information.
 *
 * This mixin strips the user's private information from the user object.
 *
 * @param Model
 * @param properties
 */
module.exports = function(Model, properties) {
  Model.afterRemote('**', async function(ctx, data, next) {
    // assign default role in case no accessToken is used
    let role = '$everyone';

    // return empty if there is no data
    if (!data) {
      return;
    }

    // if accessToken is present, change role to the role of the user
    if (ctx.req.accessToken) {
      // get role from current user
      const rolemappingId = (await Model.app.models.RoleMapping.find({where: {principalId: ctx.req.accessToken.userId}}).catch(err => console.log(err)))[0]['roleId'];
      role = (await Model.app.models.Role.findById(rolemappingId).catch(err => console.log(err)))['name'];
    }

    if (role !== 'Administrator') {
      // loop through all specified properties
      for (let property in properties) {
        if (properties[property]) {
          // remove specified property from object
          if (!ctx.req.accessToken || ctx.req.accessToken.userId !== data['id']) {
            data = deleteKey(JSON.parse(JSON.stringify(data)), {
              key: property,
              cleanup: false,
            });
          }
        }
      }

      ctx.result = data;
    }

    next();
  });
};
