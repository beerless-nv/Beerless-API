'use strict';

const axios = require('axios');

const LoopBackContext = require('loopback-context');
module.exports = function (Brewery) {
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
  Brewery.breweryEntry = async function (data) {
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
      http: { source: 'body' },
      required: true,
    },
    returns: { type: 'object', root: true },
    http: { path: '/breweryEntry', verb: 'post' },
  });

  /**
   * Uploads all breweries to the entitylabel brewery_list in Oswald.
   *
   * @returns {Promise<boolean>}
   */
  Brewery.uploadEntities = async function (req, next) {
    // check header
    if (req.get('x-appengine-cron') !== 'true') {
      //401 ERROR Message
      const err = new Error();
      err.statusCode = 401;
      err.message = 'Authorization Required';
      err.code = 'AUTHORIZATION_REQUIRED';
      next(err);
      return;
    }

    // variables
    const breweries = await Brewery.find({ where: { isApproved: 1 } });
    const chatbotId = '5c909b61ccc52e00050a6e76';
    const baseUri = 'https://admin-api-acc.oswald.ai/api/v1';
    const entityLabelId = '5cb6d923d9480f0006127fb2';
    let data = [];
    let value = {};
    let synonyms = [];
    let credentials = {
      "email": "info@beerless.be",
      "password": "sselreeB1998"
    };

    //get login access token
    const login = (await axios.post(baseUri + "/users/login", credentials))['data'];

    //add acces token to options
    const options = {
      'headers': {
        'Content-Type': 'application/json'
      },
      'params': {
        'access_token': login['id'],
      }
    };

    //Loop through all breweries to make json
    for (const brewery of breweries) {
      //Get breweryname from breweries
      let breweryName = brewery["name"];
      let row = "";
      let regex = /[.]/g;

      //Create boolean to check '.'
      let includesCharacter = regex.test(breweryName);

      //Check if breweryname contains '.'
      if (includesCharacter) {
        //Remove special character '.'
        value = { "en": breweryName };
        synonyms = [{ "text": breweryName.replace(regex, ''), "lang": "en" }];
      }
      else {
        //Add only breweryname to json if no '.' character
        value = { "en": breweryName };
        synonyms = [];
      }
      row = { value: value, synonyms: synonyms, "useForCorrections": true };
      data.push(row);
    }

    //Create body
    const body = {
      "language": "en",
      "keepExisting": false,
      "data": data
    };

    //POST request
    axios.post(baseUri + '/entity-labels/' + entityLabelId + '/load-file-entity', body, options).catch(err => console.log(err));

    //Return data
    return data;
  };

  Brewery.remoteMethod('uploadEntities', {
    accepts: [
      { arg: 'req', type: 'object', 'http': { source: 'req' } }
    ],
    http: { path: '/uploadEntities', verb: 'get' },
    returns: { type: 'array', root: true },
  });
};
