'use strict';

const axios = require('axios');

const LoopBackContext = require('loopback-context');
module.exports = function(Brewery) {
  /**
   * Validation
   */
  Brewery.validatesPresenceOf('contactId');
  Brewery.validatesUniquenessOf('name');
  Brewery.validatesNumericalityOf('contactId', 'isApproved');

  /**
   * User entries for breweries
   *
   * @param data
   * @returns {Promise<void>}
   */
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

  /**
   * Uploads all breweries to the entitylabel brewery_list in Oswald.
   *
   * @returns {Promise<boolean>}
   */
  Brewery.uploadEntities = async function() {
    // variables
    const breweries = await Brewery.find();
    const chatbotId = '5c909b61ccc52e00050a6e76';
    const baseUri = 'https://admin-api.oswald.ai/api/v1';
    const entityLabelId = '5ca5b5f6696d2900055a1df1';
    const params = {
      'access_token': 'NEjjJgDwVTx4g7biimfuHobQixgtPWriJHYgq9ZXNwgi9V3ZddCA4gOBPWb0VFcb',
    };
    const payload = {
      'label': 'brewery_list',
      'useForCorrections': true,
      'chatbotId': chatbotId,
    };

    for (const brewery of breweries) {
      const payload = {
        'value': {
          'en': brewery['name'],
        },
        'useForCorrections': true,
        'chatbotId': chatbotId,
      };

      const result = await axios.post(baseUri + '/entity-labels/' + entityLabelId + '/values', payload, {params: params});
    }

    return true;
  };

  Brewery.remoteMethod('uploadEntities', {
    http: {path: '/uploadEntities', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });
};
