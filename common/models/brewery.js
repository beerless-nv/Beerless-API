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
  Brewery.uploadEntities = async function(req, next) {
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
    const breweries = await Brewery.find({where: {isApproved: 1}});
    const chatbotId = '5c909b61ccc52e00050a6e76';
    const baseUri = 'https://admin-api.oswald.ai/api/v1';
    const entityLabelId = '5cda657629ba2e00052af1a0';
    let data = [];
    let value = {};
    let synonyms = [];
    let credentials = {
      'email': 'info@beerless.be',
      'password': 'sselreeB1998',
    };

    //get login access token
    const login = (await axios.post(baseUri + '/users/login', credentials))['data'];

    //add acces token to options
    const options = {
      'headers': {
        'Content-Type': 'application/json',
      },
      'params': {
        'access_token': login['id'],
      },
    };

    //Loop through all breweries to make json
    for (const brewery of breweries) {
      //Get breweryname from breweries
      let breweryName = brewery['name'];
      let row = '';
      let regex = /[.]/g;

      //Create boolean to check '.'
      let includesCharacter = regex.test(breweryName);

      //Check if breweryname contains '.'
      if (includesCharacter) {
        //Remove special character '.'
        value = {'en': breweryName};
        synonyms = [{'text': breweryName.replace(regex, ''), 'lang': 'en'}];
      } else {
        //Add only breweryname to json if no '.' character
        value = {'en': breweryName};
        synonyms = [];
      }
      row = {value: value, synonyms: synonyms, 'useForCorrections': true};
      data.push(row);
    }

    //Create body
    const body = {
      'language': 'en',
      'keepExisting': false,
      'data': data,
    };

    //POST request
    axios.post(baseUri + '/entity-labels/' + entityLabelId + '/load-file-entity', body, options).catch(err => console.log(err));

    //Return data
    return data;
  };

  Brewery.remoteMethod('uploadEntities', {
    accepts: [
      {arg: 'req', type: 'object', 'http': {source: 'req'}},
    ],
    http: {path: '/uploadEntities', verb: 'get'},
    returns: {type: 'array', root: true},
  });

  /**
   * Brewery search method (ElasticSearch)
   *
   * @param q
   * @param from
   * @param size
   * @returns {Promise<void>}
   */
  Brewery.search = async function(q, from, size) {
    if (!q) return null;
    if (from !== 0) {
      if (!from) return null;
    }
    if (!size) return null;

    const result = await es.search({
      index: 'breweries',
      body: {
        query: {
          match: {
            name: q,
          },
        },
      },
      from: from,
      size: size,
    });

    return result.body.hits;
  };

  Brewery.remoteMethod('search', {
    accepts: [
      {arg: 'q', type: 'string', required: true},
      {arg: 'from', type: 'number', required: true},
      {arg: 'size', type: 'number', required: true},
    ],
    http: {path: '/search', verb: 'get'},
    returns: {type: 'object', root: true},
  });

  /**
   * Brewery search suggestion method (ElasticSearch)
   *
   * @param q
   * @param size
   * @returns {Promise<void>}
   */
  Brewery.suggest = async function(q, size) {
    if (!q) return null;
    if (!size) return null;

    const result = await es.search({
      index: 'breweries',
      body: {
        suggest: {
          'suggest-brewery': {
            text: q,
            completion: {
              field: 'name_suggest',
              skip_duplicates: true,
              size: size
            },
          },
        },
      },
    });

    return result.body.suggest['suggest-brewery'][0]['options'];
  };

  Brewery.remoteMethod('suggest', {
    accepts: [
      {arg: 'q', type: 'string', required: true},
      {arg: 'size', type: 'number', required: true},
    ],
    http: {path: '/suggest', verb: 'get'},
    returns: {type: 'object', root: true},
  });

  /**
   *
   * Load all breweries to ElasticSearch.
   *
   * @returns {Promise<boolean>}
   */
  Brewery.loadAllBreweriesToES = async function() {
    await Brewery.find({include: ['beers', 'contact']}, async function(err, breweries) {
      console.log(breweries);

      if (breweries) {
        breweries.map(async brewery => {
          if (brewery['isApproved'] === 1) {
            brewery['name_suggest'] = brewery['name'];

            await es.create({
              index: 'breweries',
              body: brewery,
              id: brewery['id'],
            }, function(err, resp) {
              if (err) return false;
              if (resp) return true;
            });
          }
        });
      }
    });
  };

  Brewery.remoteMethod('loadAllBreweriesToES', {
    http: {path: '/loadAllBreweriesToES', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });

  /**
   * Load single brewery to ElasticSearch.
   *
   * @param brewery
   * @returns {Promise<void>}
   */
  Brewery.loadBreweryToEs = async function(brewery) {
    if (!brewery) return false;

    brewery['name_suggest'] = brewery['name'];

    await es.create({
      index: 'breweries',
      body: brewery,
      id: brewery['id'],
    }, function(err, resp) {
      if (err) return false;
      if (resp) return true;
    });
  };

  Brewery.remoteMethod('loadBreweryToEs', {
    accepts: [
      {arg: 'brewery', type: 'object', http: {source: 'body'}, required: true},
    ],
    http: {path: '/loadBreweryToEs', verb: 'post'},
    returns: {type: 'boolean', root: true},
  });

  /**
   * Delete beer from ElasticSearch.
   *
   * @param breweryId
   * @returns {Promise<void>}
   */
  Brewery.deleteBreweryEs = async function(breweryId) {
    if (!breweryId) return false;

    await es.delete({
      index: 'breweries',
      id: breweryId,
    }, function(err, resp) {
      if (err) return false;
      if (resp) return true;
    });
  };

  Brewery.remoteMethod('deleteBreweryEs', {
    accepts: [
      {arg: 'breweryId', type: 'number', required: true},
    ],
    http: {path: '/deleteBreweryEs', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });

  /**
   * Create index in ElasticSearch
   *
   * @returns {Promise<void>}
   */
  Brewery.createIndexES = async function() {
    // delete previous index
    await es.indices.exists({index: 'breweries'}, async function(err, resp) {
      if (resp.statusCode === 200) {
        await es.indices.delete({index: 'breweries'}, function(err, resp) {
        });
      }

      // create new index
      await es.indices.create({
        index: 'breweries',
        body: {
          mappings: {
            properties: {
              'beers.ABV': {
                type: 'float',
              },
              'contact.id': {type: 'long'},
              'contact.website': {type: 'text'},
              'contact.twitter': {type: 'text'},
              'contact.facebook': {type: 'text'},
              'contact.instagram': {type: 'text'},
              'contact.breweryId': {type: 'long'},
              'contact.timestampCreated': {type: 'date'},
              'contact.timestampUpdated': {type: 'date'},
              name_suggest: {
                type: 'completion',
              },
            },
          },
        },
      }, async function(err, resp) {
        if (err) return false;
        if (resp) return true;
      });
    });
  };

  Brewery.remoteMethod('createIndexES', {
    http: {path: '/createIndexES', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });
};
