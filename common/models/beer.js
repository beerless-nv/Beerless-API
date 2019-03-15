'use strict';

const LoopBackContext = require('loopback-context');
module.exports = function(Beer) {
  Beer.beerEntry = async function(data) {
    // check if isApproved exists
    if (!data['isApproved']) {
      data['isApproved'] = 0;

      // get userId
      const ctx = LoopBackContext.getCurrentContext();
      const userId = (ctx && ctx.get('currentUser')).id;

      // define activityType
      let activityTypeId = 1;
      if (data['id']) {
        activityTypeId = 2;
      }

      // insert beer object in db
      const beer = await Beer.create(data);

      // add activity for the insert
      const activity = {
        'timestampCreated': '1970-01-01T00:00:00.000Z',
        'timestampUpdated': '1970-01-01T00:00:00.000Z',
        'beerId': beer.id,
        'breweryId': 0,
        'articleId': 0,
        'userId': userId,
        'activityTypeId': activityTypeId,
        'isApproved': 0,
      };

      Beer.app.models.Activity.create(activity);

      return beer.id;
    }
  };

  Beer.remoteMethod('beerEntry', {
    accepts: {
      arg: 'data',
      type: 'object',
      http: {source: 'body'},
      required: true,
    },
    returns: {type: 'object', root: true},
    http: {path: '/beerEntry', verb: 'post'},
  });
};
