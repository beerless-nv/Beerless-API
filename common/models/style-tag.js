'use strict';

const LoopBackContext = require('loopback-context');
const axios = require('axios');

module.exports = function (Styletag) {
  /**
   * Validation
   */
  Styletag.validatesUniquenessOf('name');
  Styletag.validatesPresenceOf('styletagCategoryId');
  Styletag.validatesNumericalityOf('styletagCategoryId');

  /**
   * Uploads all styletags to the entitylabel styletag_list in Oswald.
   *
   * @returns {Promise<boolean>}
   */
  Styletag.uploadEntities = async function (req, next) {
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
    const styletags = await Styletag.find({ where: { isApproved: 1 } });
    const chatbotId = '5c909b61ccc52e00050a6e76';
    const baseUri = 'https://admin-api.oswald.ai/api/v1';
    const entityLabelId = '5cda657629ba2e00052af19f';
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

    //Loop through all styletags to make json file
    for (const styletag of styletags) {
      //Get styletagName from styletags
      let styletagName = styletag["name"];
      let row = "";
      let regex = /[.]/g;

      //Create boolean to check '.'
      let includesCharacter = regex.test(styletagName);

      //Check if styletagName contains '.'
      if (includesCharacter) {
        //Remove special character '.'
        value = { "en": styletagName };
        synonyms = [{ "text": styletagName.replace(regex, ''), "lang": "en" }];
      }
      else {
        //Add only styletagName to csv if no '.' character
        value = { "en": styletagName };
        synonyms = [];
      }
      row = { value: value, synonyms: synonyms, "useForCorrections": true };
      data.push(row);
    };

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

  Styletag.remoteMethod('uploadEntities', {
    accepts: [
      { arg: 'req', type: 'object', 'http': { source: 'req' } }
    ],
    http: { path: '/uploadEntities', verb: 'get' },
    returns: { type: 'array', root: true },
  });
};
