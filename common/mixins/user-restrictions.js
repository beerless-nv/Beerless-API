'use strict';

module.exports = function(Model, properties) {
  Model.afterRemote('**', async function(ctx, data, next) {

    // get role from current user
    const rolemappingId = (await Model.app.models.RoleMapping.find({where: {principalId: ctx.req.accessToken.userId}}))[0]['roleId'];
    const role = (await Model.app.models.Role.findById(rolemappingId))['name'];

    if (role !== 'Administrator') {

      // loop through all specified properties
      for (let property in properties) {
        if (properties[property]) {

          // remove specified property from object
          if (Array.isArray(data)) {
            data.map(item => {
              delete item.__data[property];
            });
          } else {
            delete data.__data[property];
          }
        }
      }
    }

    next();
  });
};
