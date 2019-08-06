'use strict';

const LoopBackContext = require('loopback-context');
const axios = require('axios');
const app = require('./../../server/server');

module.exports = function(Beer) {
  /**
   * Validation
   */
  Beer.validatesPresenceOf('name', 'ABV');
  Beer.validatesNumericalityOf('ABV', 'IBU', 'EBC', 'temperature', 'since', 'statusId');
  function beerNameValidator(err, done) {
    Beer.find({where: {name: this.name}})
      .then(result => {
        console.log(result);
        if (result.length > 0) err();
        done();
      });
  }

  /**
   * User entries for beers
   * Remote hooks for create method which is used both for new entries
   * and update entries.
   * The hooks set a statusId and create a new activity for the user.
   */
  Beer.beforeRemote('create', async function(ctx, modelInstance, next) {
    const beer = ctx.req.body;

    // set statusId = 1 (pending) if entry from user
    beer.statusId = 1;

    next();
  });

  Beer.afterRemote('create', async function(ctx, modalInstance, next) {
    let activityTypeId;

    // Chose activityType based on whether or not the originalId is entered
    if (modalInstance.originalId === 0) {
      activityTypeId = 1;
      Beer.validateAsync('name', beerNameValidator, {message: 'is not unique'});
    } else {
      activityTypeId = 2;
    }

    const activity = {
      activityTypeId: activityTypeId,
      userId: ctx.req.accessToken.userId,
      articleId: 0,
      beerId: modalInstance.id,
      breweryId: 0,
      statusId: 1
    };

    // Create pending activity
    Beer.app.models.Activity.create(activity, next());
  });

  /**
   * Remote hook for the approval system.
   * The hook makes sure the entries from users are updated correctly and
   * previous entries are archived.
   */
  Beer.afterRemote('replaceById', async function(ctx, modalInstance, next) {
    switch (modalInstance.statusId) {
      case 2:
        // Update previous versions of the beer
        if (modalInstance.originalId !== 0) {
          const previousVersions = await Beer.find({where: {or: [{id: modalInstance.originalId}, {originalId: modalInstance.originalId}]}});

          previousVersions.map(beer => {
            if (beer.statusId !== 2 && beer.statusId !== 5 && beer.id !== modalInstance.id) {
              beer.updateAttribute('statusId', 5, function(err, resp) {
                if (err) {}
                if (resp) {}
              });
            }
          })
        }

        // Upload beer to ElasticSearch
        Beer.loadBeerToEs(modalInstance);
        break;
      case 1:
      case 3:
      case 5:
        // Delete beer from ElasticSearch
        Beer.deleteBeerEs(modalInstance.id);
        break;
    }

    if (modalInstance.statusId !== 5) {
      // Update activity
      const activity = await Beer.app.models.Activity.findOne({where: {'beerId': modalInstance.id}});
      activity.updateAttribute('statusId', modalInstance.statusId, next());
    }

    next();
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

    beer.name_suggest = beer.name;

    await es.create({
      index: 'beers',
      body: beer,
      id: beer.id,
    }, function(err, resp) {
      if (err) console.log(err);
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
