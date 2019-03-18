'use strict';

const LoopBackContext = require('loopback-context');
module.exports = function(Brewery) {
  Brewery.breweryEntry = async function(data) {
    // check if isApproved exists
    if (!data['isApproved']) {
      data['isApproved'] = 0;

      // get userId
      const ctx = LoopBackContext.getCurrentContext();
      const userId = (ctx && ctx.get('currentUser')).id;

      // define activityType
      let breweryId = data['id'];
      let activityTypeId = 3;
      if (data['id']) {
        data['id'] = null;
        activityTypeId = 4;
      }

      // insert brewery object in db
      const brewery = await Brewery.create(data);

      // add activity for the insert
      const activity = {
        'timestampCreated': '1970-01-01T00:00:00.000Z',
        'timestampUpdated': '1970-01-01T00:00:00.000Z',
        'breweryId': brewery.id,
        'beerId': 0,
        'articleId': 0,
        'userId': userId,
        'activityTypeId': activityTypeId,
        'originalId': breweryId,
        'isApproved': 0,
      };

      Brewery.app.models.Activity.create(activity);

      return brewery;
    }
  };

  Brewery.remoteMethod('breweryEntry', {
    accepts: {
      arg: 'data',
      type: 'object',
      http: {source: 'body'},
      required: true,
    },
    returns: {type: 'object', root: true},
    http: {path: '/breweryEntry', verb: 'post'},
  });
};
