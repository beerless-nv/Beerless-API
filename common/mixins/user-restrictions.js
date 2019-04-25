'use strict';

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
    // Assign default role in case no accessToken is used
    let role = '$everyone';

    // if accessToken is present, change role to the role of the user
    if (ctx.req.accessToken) {

      // get role from current user
      const rolemappingId = (await Model.app.models.RoleMapping.find({where: {principalId: ctx.req.accessToken.userId}}))[0]['roleId'];
      role = (await Model.app.models.Role.findById(rolemappingId))['name'];
    }

    if (role !== 'Administrator') {
      // loop through all specified properties
      for (let property in properties) {
        if (properties[property]) {

          // remove specified property from object
          if (Array.isArray(data)) {
            data.map(item => {
              if (item.__data) {
                delete item.__data[property];
              } else {
                delete item[property];
              }
            });
          } else {
            if (data.__data) {
              delete data.__data[property];
            } else {
              delete data[property];
            }
          }
        }
      }
    }

    next();
  });
};