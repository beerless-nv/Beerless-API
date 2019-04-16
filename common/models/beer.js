'use strict';

const LoopBackContext = require('loopback-context');
const axios = require('axios');
var Blob = require('node-blob');
var fs = 

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
    const beers = await Beer.find({where: {isApproved:1}});
    const chatbotId = '5c909b61ccc52e00050a6e76';
    const baseUri = 'https://admin-api-acc.oswald.ai/api/v1';
    const entityLabelId = '5cb587844648730006817311';
    // const cols = [["beername", "synonymA"]];
    // let csvContent = "data:text/csv;charset=utf-8," + cols.map(e=>e.join(",")) + "\n";
    var data = [];
    var value = {};
    var synonyms = [];
    const options = {
      'headers' : {
        'Content-Type' : 'application/json'
      },
      'params' : {
      'access_token': 'bSRuHuVDxaUIIy0DYf01IcB1vcqolAggwvLPaLxVkqEzOFBxOjztJbemRzI6YvCk',
      }
  };
    

    for (const beer of beers) {
      //Get beername from beers
      var beerName = beer["name"];
      let row = "";
      var regex = /[.]/g;

      //Create boolean to check '.'
      var includesCharacter = regex.test(beerName);

      

      //Check if beername contains '.'
      if(includesCharacter){
        //Remove special character '.'
        value = {"en": beerName};
        synonyms = [{"text" : beerName.replace(regex, ''), "lang" : "en"}];
      }
      else{
        //Add only beername to csv if no '.' character
        value = {"en": beerName};
        synonyms = [];
      }
      row = {value: value, synonyms: synonyms, "useForCorrections" : true};
      data.push(row);
    };

    
    //Create body
    const body = {
      "language" : "en",
      "keepExisting": false,
      "data": data
    };

    //POST request
    axios.post(baseUri + '/entity-labels/' + entityLabelId + '/load-file-entity',body, options).catch(err => console.log(err));


    return data;
  };

  Beer.remoteMethod('uploadEntities', {
    http: {path: '/uploadEntities', verb: 'get'},
    returns: {type: 'array', root: true},
  });
};
