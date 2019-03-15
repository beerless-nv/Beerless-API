'use strict';

module.exports = function(Beer) {
  Beer.beerEntry = async function(data) {

    // check if isApproved exists
    if (!data['isApproved']) {

      // insert beer object in db
      data['isApproved'] = 0;
      // const beer = Beer.create(data);

      // get userId
      // const token = options && options.accessToken;


      // // add activity for the insert
      // const activity = {
      //   "timestampCreated": "1970-01-01T00:00:00.000Z",
      //   "timestampUpdated": "1970-01-01T00:00:00.000Z",
      //   "beerId": beer['id'],
      //   "breweryId": 0,
      //   "articleId": 0,
      //   "userId": 0,
      //   "activityTypeId": 0,
      //   "isApproved": 0
      // };
      //
      // Beer.app.models.Activity.create(activity);
      return currentUser;
    }
  };

  Beer.remoteMethod('beerEntry', {
    accepts: {arg: 'data', type: 'object', http: {source: 'body'}, required: true},
    returns: {type: 'object', root: true},
    http: {path: '/beerEntry', verb: 'post'},
  });
};
