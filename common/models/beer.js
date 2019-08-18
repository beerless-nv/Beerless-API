'use strict';

const LoopBackContext = require('loopback-context');
const axios = require('axios');
const app = require('./../../server/server');

module.exports = function(Beer) {
  /**
   * Validation
   */
  Beer.validatesPresenceOf('name', 'ABV');
  Beer.validatesNumericalityOf('ABV', 'IBU', 'EBC', 'temperature', 'since');
  Beer.validatesUniquenessOf('name');

  Beer.observe('after save', async function(ctx, next) {
    if (ctx.instance) {
      // load new beer to ElasticSearch
      Beer.createBeerEs(ctx.instance.id).catch(err => console.log(err));
    } else {
      // update beer in ElasticSearch
      console.log('updated', ctx.where);
    }
  });

  Beer.observe('after delete', async function(ctx, next) {
    // delete beer from ElasticSearch
    console.log('deleted', ctx.where);
  });

  /**
   * Item-based beer recommendations
   *
   * @param beerId
   * @param amount
   * @param res
   * @returns {Promise<*>}
   */
  Beer.itemBasedRecommendation = async function(beerId, amount, next) {
    return new Promise(async function(resolve, reject) {
      let recommendations = [];

      // check if beer exists
      const beer = await Beer.findById(beerId).catch(err => console.log(err));
      if (!beer) {
        const err = new Error();
        err.statusCode = 404;
        err.message = 'Beer not found';
        err.code = 'ITEM_NOT_FOUND';
        next(err);
        return;
      }

      // http request to recommendation script
      axios.get(app.get('recommendations_url') + '?beerId=' + beerId + '&amount=' + amount)
        .then(async(response) => {
          if (response.data.length > 0) {
            for (const recommendation of response.data) {

              // check if beer exists
              const beer = await Beer.findById(recommendation.beerId, {
                fields: {
                  id: true,
                  name: true,
                  logo: true,
                  description: true,
                },
              }).catch(err => console.log(err));
              if (beer) {
                // make recommendation objects and add it to the array
                recommendations.push({
                  beer: beer, distance: recommendation.distance,
                });
              }

              if (recommendations.length === amount) {
                resolve(recommendations);
                return;
              }
            }

            resolve(recommendations);
          } else {
            //404 ERROR Message
            const err = new Error();
            err.statusCode = 404;
            err.message = 'Beer not found';
            err.code = 'ITEM_NOT_FOUND';
            next(err);
            return;
          }
        }).catch((error) => {
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
   * Uploads all beers to the entitylabel beer_list in Oswald.
   *
   * @returns {Promise<boolean>}
   */
  Beer.uploadEntities = async function(req, next) {
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

    //variables
    const beers = await Beer.find({where: {isApproved: 1}}).catch(err => console.log(err));
    const chatbotId = '5c909b61ccc52e00050a6e76';
    const baseUri = 'https://admin-api.oswald.ai/api/v1';
    const entityLabelId = '5cda657629ba2e00052af19e';
    let data = [];
    let value = {};
    let synonyms = [];
    let credentials = {
      'email': process.env.OSWALD_EMAIL,
      'password': process.env.OSWALD_PASSWORD
    };

    //get login access token
    const login = (await axios.post(baseUri + '/users/login', credentials).catch(err => console.log(err)))['data'];

    //add acces token to options
    const options = {
      'headers': {
        'Content-Type': 'application/json',
      },
      'params': {
        'access_token': login['id'],
      },
    };

    //Get all beernames and modify them for json
    for (const beer of beers) {
      //Get beername from beers
      let beerName = beer['name'];
      let row = '';
      let regex = /[.]/g;

      //Create boolean to check '.'
      let includesCharacter = regex.test(beerName);

      //Check if beername contains '.'
      if (includesCharacter) {
        //Remove special character '.'
        value = {'en': beerName};
        synonyms = [{'text': beerName.replace(regex, ''), 'lang': 'en'}];
      } else {
        //Add only beername to csv if no '.' character
        value = {'en': beerName};
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

    //Return json data array
    return data;
  };

  Beer.remoteMethod('uploadEntities', {
    accepts: [
      {arg: 'req', type: 'object', 'http': {source: 'req'}},
    ],
    http: {path: '/uploadEntities', verb: 'get'},
    returns: {type: 'array', root: true},
  });

  /**
   * Get all beers from a specified brewery.
   *
   * @param beer
   * @param brewery
   * @returns {Promise<*[]>}
   */
  Beer.getBeerFromBrewery = async function(beer, brewery) {
    const result = JSON.parse(JSON.stringify(await Beer.find({
      where: {name: beer},
      include: [{
        relation: 'breweries',
        scope: {where: {name: brewery}},
      }, 'styleTags'],
    }).catch(err => console.log(err))));

    for (let resultKey in result) {
      if ((result[resultKey]['breweries']).length > 0) {
        return [result[resultKey]];
      }
    }

    return;
  };

  Beer.remoteMethod('getBeerFromBrewery', {
    accepts: [
      {arg: 'beer', type: 'string', required: true},
      {arg: 'brewery', type: 'string', required: true},
    ],
    http: {path: '/beerFromBreweryByName', verb: 'get'},
    returns: {type: 'array', root: true},
  });

  /**
   * Beer search method (ElasticSearch)
   *
   * @param q
   * @param from
   * @param size
   * @returns {Promise<void>}
   */
  Beer.search = async function(q, from, size) {
    if (!q) return null;
    if (from !== 0) {
      if (!from) return null;
    }
    if (!size) return null;

    const result = await es.search({
      index: 'beers',
      body: {
        query: {
          match: {
            name: q,
          },
        },
      },
      from: from,
      size: size,
    }).catch(err => console.log(err));

    return result.body.hits;
  };

  Beer.remoteMethod('search', {
    accepts: [
      {arg: 'q', type: 'string', required: true},
      {arg: 'from', type: 'number', required: true},
      {arg: 'size', type: 'number', required: true},
    ],
    http: {path: '/search', verb: 'get'},
    returns: {type: 'object', root: true},
  });

  /**
   * Beer search suggestion method (ElasticSearch)
   *
   * @param q
   * @param size
   * @returns {Promise<void>}
   */
  Beer.suggest = async function(q, size) {
    if (!q) return null;
    if (!size) return null;

    const result = await es.search({
      index: 'beers',
      body: {
        suggest: {
          'suggest-beer': {
            text: q,
            completion: {
              field: 'name_suggest',
              skip_duplicates: true,
              size: size,
            },
          },
        },
      },
    }).catch(err => console.log(err));

    return result.body.suggest['suggest-beer'][0]['options'];
  };

  Beer.remoteMethod('suggest', {
    accepts: [
      {arg: 'q', type: 'string', required: true},
      {arg: 'size', type: 'number', required: true},
    ],
    http: {path: '/suggest', verb: 'get'},
    returns: {type: 'object', root: true},
  });

  /**
   * Load all beers to ElasticSearch.
   *
   * @returns {Promise<boolean>}
   */
  Beer.loadAllBeersToES = async function() {
    await Beer.find({include: ['breweries', 'styleTags']}, async function(err, beers) {
      if (beers) {
        beers.map(async beer => {
          beer.name_suggest = beer.name;

          await es.create({
            index: 'beers',
            body: beer,
            id: beer.id,
          }, function(err, resp) {
            if (err) return false;
            if (resp) return true;
          }).catch(err => console.log(err));
        });
      }
    }).catch(err => console.log(err));
  };

  Beer.remoteMethod('loadAllBeersToES', {
    http: {path: '/loadAllBeersToES', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });

  /**
   * Load single beer to ElasticSearch.
   *
   * @param beerId
   * @returns {Promise<boolean>}
   */
  Beer.createBeerEs = async function(beerId) {
    if (!beerId) return false;

    await Beer.findById(beerId, {include: ['breweries', 'styleTags']}, async function(err, beer) {
      beer.name_suggest = beer.name;

      await es.create({
        index: 'beers',
        body: beer,
        id: beer.id,
      }).catch(err => console.log(err));
    });
  };

  Beer.remoteMethod('createBeerEs', {
    accepts: [
      {arg: 'beerId', type: 'number', required: true},
    ],
    http: {path: '/createBeerEs', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });

  /**
   * Update beer from ElasticSearch.
   *
   * @param beerId
   * @returns {Promise<boolean>}
   */
  Beer.updateBeerES = async function(beerId) {
    if (!beerId) return false;

    await Beer.deleteBeerEs(beerId).catch(err => console.log(err));
    await Beer.createBeerEs(beerId).catch(err => console.log(err));
  };

  Beer.remoteMethod('updateBeerES', {
    accepts: [
      {arg: 'beerId', type: 'number', required: true},
    ],
    http: {path: '/updateBeerES', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });

  /**
   * Delete beer from ElasticSearch.
   *
   * @param beerId
   * @returns {Promise<void>}
   */
  Beer.deleteBeerEs = async function(beerId) {
    if (!beerId) return false;

    await es.delete({
      index: 'beers',
      id: beerId,
    }, function(err, resp) {
      if (err) return false;
      if (resp) return true;
    }).catch(err => console.log(err));
  };

  Beer.remoteMethod('deleteBeerEs', {
    accepts: [
      {arg: 'beerId', type: 'number', required: true},
    ],
    http: {path: '/deleteBeerEs', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });

  /**
   * Create index in ElasticSearch
   *
   * @returns {Promise<void>}
   */
  Beer.createIndexES = async function() {
    // delete previous index
    await es.indices.exists({index: 'beers'}, async function(err, resp) {
      if (resp.statusCode === 200) {
        await es.indices.delete({index: 'beers'}, function(err, resp) {
        }).catch(err => console.log(err));
      }

      // create new index
      await es.indices.create({
        index: 'beers',
        body: {
          mappings: {
            properties: {
              ABV: {
                type: 'float',
              },
              name_suggest: {
                type: 'completion',
              },
            },
          },
        },
      }, async function(err, resp) {
        if (err) return false;
        if (resp) return true;
      }).catch(err => console.log(err));
    }).catch(err => console.log(err));
  };

  Beer.remoteMethod('createIndexES', {
    http: {path: '/createIndexES', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });
};
