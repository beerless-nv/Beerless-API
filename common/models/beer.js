'use strict';

const LoopBackContext = require('loopback-context');
const axios = require('axios');

module.exports = function(Beer) {
  /**
   * Validation
   */
  Beer.validatesPresenceOf('name', 'ABV');
  Beer.validatesNumericalityOf('ABV', 'IBU', 'EBC', 'temperature', 'since', 'isApproved');
  Beer.validatesUniquenessOf('name');

  /**
   * User entries for beers
   *
   * @param data
   * @returns {Promise<void>}
   */
  Beer.beerEntry = async function(data) {
    // check if isApproved exists
    if (!data['isApproved']) {
      data['isApproved'] = 0;

      // get userId
      const ctx = LoopBackContext.getCurrentContext();
      const userId = (ctx && ctx.get('currentUser')).id;

      // define activityType
      let beerId = data['id'];
      let activityTypeId = 1;
      if (data['id']) {
        data['id'] = null;
        activityTypeId = 2;
      }

      // insert beer object in db
      const beer = await Beer.create(data);

      // add activity for the insert
      const activity = {
        'timestampCreated': '1970-01-01T00:00:00.000Z',
        'timestampUpdated': '1970-01-01T00:00:00.000Z',
        'breweryId': 0,
        'beerId': beer.id,
        'articleId': 0,
        'userId': userId,
        'activityTypeId': activityTypeId,
        'originalId': beerId,
        'isApproved': 0,
      };

      Beer.app.models.Activity.create(activity);

      return beer;
    }
  };

  Beer.remoteMethod('beerEntry', {
    accepts: {
      arg: 'data',
      type: 'object',
      http: {source: 'body'},
      required: true,
    },
    http: {path: '/beerEntry', verb: 'post'},
    returns: {type: 'object', root: true},
  });

  /**
   * Item-based beer recommendations
   *
   * @param beerId
   * @param amount
   * @param res
   * @returns {Promise<*>}
   */
  Beer.itemBasedRecommendation = async function(beerId, amount, res) {
    return new Promise(function(resolve, reject) {
      let recommendations = [];

      // http request to recommendation script
      axios.get('https://beerless-scripts-1.appspot.com/itemBasedRecommendation?beerId=' + beerId + '&amount=' + amount)
        .then(async(response) => {
          for (const recommendation of response.data) {

            // make recommendation objects and add it to the array
            recommendations.push(
              {
                beer: await Beer.findById(recommendation.beerId),
                distance: recommendation.distance,
              },
            );
          }

          resolve(recommendations);
        })
        .catch((error) => {
          console.log(error);
        });
    });
  };

  Beer.remoteMethod('itemBasedRecommendation', {
    accepts: [
      {arg: 'beerId', type: 'number', required: true},
      {arg: 'amount', type: 'number', required: true},
    ],
    http: {path: '/itemBasedRecommendation', verb: 'get'},
    returns: {type: 'object', root: true},
  });

  /**
   * Beer search method
   *
   * @param data
   * @returns {Promise<void>}
   */
  Beer.search = async function(data) {
    // create sql query
    const query = 'SELECT * FROM Beer WHERE name COLLATE UTF8_GENERAL_CI like ?';

    // define datasource
    const ds = Beer.dataSource;

    // execute query on database
    return new Promise(resolve => {
      ds.connector.query(query, ['%' + data + '%'], function(err, result) {
        resolve(result);
      });
    });
  };

  Beer.remoteMethod('search', {
    accepts: {arg: 'value', type: 'string', required: true},
    http: {path: '/search', verb: 'get'},
    returns: {type: 'object', root: true},
  });

  /**
   * Uploads all beers to the entitylabel beer_list in Oswald.
   *
   * @returns {Promise<boolean>}
   */
  Beer.uploadEntities = async function() {
    // variables
    const beers = await Beer.find();
    const chatbotId = '5c909b61ccc52e00050a6e76';
    const baseUri = 'https://admin-api.oswald.ai/api/v1';
    const entityLabelId = '5c9cd1b36077d200051fcf5d';
    const params = {
      'access_token': 'NEjjJgDwVTx4g7biimfuHobQixgtPWriJHYgq9ZXNwgi9V3ZddCA4gOBPWb0VFcb',
    };
    const payload = {
      'label': 'beer_list',
      'useForCorrections': true,
      'chatbotId': chatbotId,
    };

    for (const beer of beers) {
      const payload = {
        'value': {
          'en': beer['name'],
        },
        'synonyms': [],
        'useForCorrections': true,
        'chatbotId': chatbotId,
      };

      const result = await axios.post(baseUri + '/entity-labels/' + entityLabelId + '/values', payload, {params: params});
    }

    return true;
  };

  Beer.remoteMethod('uploadEntities', {
    http: {path: '/uploadEntities', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });
};
