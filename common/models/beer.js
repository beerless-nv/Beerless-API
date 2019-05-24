'use strict';

const LoopBackContext = require('loopback-context');
const axios = require('axios');
const app = require('./../../server/server');

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
      const beer = await Beer.create(data, function(err, beer) {
        console.log(err);
        console.log(beer);

        if (!err) {
          // add activity for the insert
          const activity = {
            'timestampCreated': '1970-01-01T00:00:00.000Z',
            'timestampUpdated': '1970-01-01T00:00:00.000Z',
            'breweryId': 0,
            'beerId': beer['id'],
            'articleId': 0,
            'userId': userId,
            'activityTypeId': activityTypeId,
            'originalId': beerId,
            'isApproved': 0,
          };
          Beer.app.models.Activity.create(activity);

          // insert breweries

          // insert beerstyle
          data.styleTags.map(styleTagId => {
            Beer.app.models.StyleTag.findById(styleTagId, function(err, styleTag) {
              if (styleTag) {
                Beer.app.models.Beerstyle.create({
                  beerId: beer['id'],
                  styleTagId: styleTagId,
                });
              }
            });
          });
        }
      });

      console.log(beer);

      return data;
    }
  };

  Beer.remoteMethod('beerEntry', {
    accepts: [
      {arg: 'data', type: 'object', http: {source: 'body'}, required: true},
    ],
    http: {path: '/beerEntry', verb: 'post'},
    returns: {type: 'object', root: true},
  });

  Beer.observe('after save', function(ctx, next) {
    // Get styletags
    Beer.findById(ctx.instance.id, {include: ['styleTags', 'breweries']}, function(err, beer) {
      if (beer) {

        console.log(beer);

        // create elasticSearch object
        if (!err) {

          // solrClient.update(data, function(err, result) {
          //   if (err) {
          //     console.log(err);
          //     return;
          //   }
          //   console.log('Response:', result.responseHeader);
          // });
        }
      }
    });
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
      const beer = await Beer.findById(beerId);
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
          console.log(beerId, amount);
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
              });
              if (beer) {
                console.log('ok');
                // make recommendation objects and add it to the array
                recommendations.push({
                  beer: beer, distance: recommendation.distance,
                });
              }

              if (recommendations.length === amount) {
                console.log(recommendations.length, amount);
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
    const beers = await Beer.find({where: {isApproved: 1}});
    const chatbotId = '5c909b61ccc52e00050a6e76';
    const baseUri = 'https://admin-api.oswald.ai/api/v1';
    const entityLabelId = '5cda657629ba2e00052af19e';
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

  Beer.getBeerFromBrewery = async function(beer, brewery) {
    const result = JSON.parse(JSON.stringify(await Beer.find({
      where: {name: beer},
      include: [{
        relation: 'breweries',
        scope: {where: {name: brewery}},
      }, 'styleTags'],
    })));

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
    });

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
    });

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
   *
   * Load all beers to ElasticSearch.
   *
   * @returns {Promise<boolean>}
   */
  Beer.loadAllBeersToES = async function() {
    await Beer.find({include: ['breweries', 'styleTags']}, async function(err, beers) {
      if (beers) {
        beers.map(async beer => {
          if (beer['isApproved'] === 1) {
            beer['name_suggest'] = beer['name'];

            await es.create({
              index: 'beers',
              body: beer,
              id: beer['id'],
            }, function(err, resp) {
              if (err) return false;
              if (resp) return true;
            });
          }
        });
      }
    });
  };

  Beer.remoteMethod('loadAllBeersToES', {
    http: {path: '/loadAllBeersToES', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });

  /**
   * Load single beer to ElasticSearch.
   *
   * @param beer
   * @returns {Promise<void>}
   */
  Beer.loadBeerToEs = async function(beer) {
    if (!beer) return false;

    beer['name_suggest'] = beer['name'];

    await es.create({
      index: 'beers',
      body: beer,
      id: beer['id'],
    }, function(err, resp) {
      if (err) return false;
      if (resp) return true;
    });
  };

  Beer.remoteMethod('loadBeerToEs', {
    accepts: [
      {arg: 'beer', type: 'object', http: {source: 'body'}, required: true},
    ],
    http: {path: '/loadBeerToEs', verb: 'post'},
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
    });
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
    console.log('ok index');
    // delete previous index
    await es.indices.exists({index: 'beers'}, async function(err, resp) {
      if (resp.statusCode === 200) {
        await es.indices.delete({index: 'beers'}, function(err, resp) {
        });
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
      });
    });
  };

  Beer.remoteMethod('createIndexES', {
    http: {path: '/createIndexES', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });
};
