'use strict';

module.exports = function(Beerentry) {
  /**
   * Validation
   */
  // Beerentry.validatesPresenceOf('beer.name', 'beer.ABV');
  // Beerentry.validatesNumericalityOf('ABV', 'IBU', 'EBC', 'temperature', 'since');
  function beerNameValidator(err, done) {
    Beerentry.find({where: {name: this.name}})
      .then(result => {
        if (result.length > 0) err();
        done();
      });
  }

  /**
   {
    "action": "create",
    "name": "testBier4",
    "ABV": 0,
    "IBU": 0,
    "EBC": 0,
    "temperature": 0,
    "fermentation": "string",
    "glass": "string",
    "logo": "beer-no-logo.svg",
    "description": "string",
    "season": "string",
    "since": 0,
    "entryId": 0,
    "beerFromBreweries": [
      {
        "isPublisher": 1,
        "beerId": 0,
        "breweryId": 222
      }
    ],
    "beerstyles": [
      {
        "styleTagId": 4,
        "beerId": 0
      }
    ]
  }
   */

  /**
   * User entries for beers
   * Remote hooks for create method which is used both for new entries
   * and update entries.
   * The hooks validate the entries and create activities, entries and related
   * objects.
   */
  Beerentry.beforeRemote('create', async function(ctx, modelInstance, next) {
    let activityTypeId, beerId;
    const statusId = 1;
    let entryObject = ctx.req.body;

    // Check if entryObject is correct
    if (!entryObject.action) {
      const err = new Error('Action is missing');
      err.statusCode = 404;
      err.code = 'PROPERTY_MISSING';
      return next(err);
    }

    // Create variables based on action
    if (entryObject.action === 'create') {
      activityTypeId = 1;
      beerId = 0;
      // Validate name
      Beerentry.validateAsync('name', beerNameValidator, {message: 'is not unique'});
    } else if (entryObject.action === 'update') {
      // Check if entryObject contains originalId
      if (!entryObject.originalId) {
        const err = new Error('OriginalId is missing');
        err.statusCode = 404;
        err.code = 'PROPERTY_MISSING';
        return next(err);
      }
      activityTypeId = 2;
      beerId = entryObject.originalId;
    } else {
      const err = new Error('Action has an invalid value');
      err.statusCode = 404;
      err.code = 'INVALID_VALUE';
      return next(err);
    }

    // Create activity
    const activity = {
      activityTypeId: activityTypeId,
      userId: ctx.req.accessToken.userId,
      articleId: 0,
      beerId: beerId,
      breweryId: 0,
      statusId: statusId,
    };
    const activityId = (await Beerentry.app.models.Activity.create(activity).catch(err => console.error(err))).id;

    // Create entry
    const entry = {
      current: 0,
      statusId: statusId,
      activityId: activityId,
    };
    const entryId = (await Beerentry.app.models.Entry.create(entry).catch(err => console.error(err))).id;

    // Update BeerEntry object
    ctx.req.body.entryId = entryId;

    next();
  });

  Beerentry.afterRemote('create', async function(ctx, modalInstance, next) {
    const beer = modalInstance;

    // Create beerstyles
    if (beer.beerstyles && beer.beerstyles.length > 0) {
      beer.beerstyles.map(beerstyle => {
        const beerstyleEntry = {
          beerId: beer.id,
          styleTagId: beerstyle.styleTagId,
        };
        Beerentry.app.models.BeerstyleEntry.create(beerstyleEntry).then(data => console.log(data)).catch(err => console.error(err));
      });
    }

    // Create beerFromBrewery
    if (beer.beerFromBreweries && beer.beerFromBreweries.length > 0) {
      beer.beerFromBreweries.map(beerFromBrewery => {
        const beerFromBreweryEntry = {
          beerId: beer.id,
          breweryId: beerFromBrewery.breweryId,
          isPublisher: beerFromBrewery.isPublisher,
        };
        Beerentry.app.models.BeerFromBreweryEntry.create(beerFromBreweryEntry).then(data => console.log(data)).catch(err => console.error(err));
      });
    }

    next();
  });

  /**
   * The beer entry is accepted and is being created.
   *
   * @param id
   * @returns {Promise<T | void>}
   */
  Beerentry.createBeer = async function(id) {
    let beer;
    const beerEntry = await Beerentry.findById(id, {fields: {id: false}}).catch(err => console.error(err));
    const beerstyleEntries = await Beerentry.app.models.BeerstyleEntry.find({where: {beerId: id}, fields: {id: false}}).catch(err => console.error(err));
    const beerFromBreweryEntries = await Beerentry.app.models.BeerFromBreweryEntry.find({where: {beerId: id}, fields: {id: false}}).catch(err => console.error(err));

    // create beer
    beer = await Beerentry.app.models.Beer.create(beerEntry).catch(err => console.error(err));

    // create new related objects
    if (beerstyleEntries.length > 0) {
      beerstyleEntries.map(async beerstyleEntry => {
        beerstyleEntry.beerId = beer.id;
        Beerentry.app.models.Beerstyle.create(beerstyleEntry).catch(err => console.error(err));
      });
    }
    if (beerFromBreweryEntries.length > 0) {
      beerFromBreweryEntries.map(async beerFromBreweryEntry => {
        beerFromBreweryEntry.beerId = beer.id;
        Beerentry.app.models.BeerFromBrewery.create(beerFromBreweryEntry).catch(err => console.error(err));
      });
    }

    return beer;
  };

  Beerentry.remoteMethod('createBeer', {
    accepts: [
      {arg: 'id', type: 'number', required: true},
    ],
    http: {path: '/:id/createBeer', verb: 'get'},
    returns: {type: 'object', root: true},
  });

  /**
   * The beer entry is accepted and is being updated.
   *
   * @param id
   * @param originalId
   * @returns {Promise<T | void>}
   */
  Beerentry.updateBeer = async function(id, originalId) {
    let beer;
    const beerEntry = await Beerentry.findById(id, {fields: {id: false, timestampCreated: false}}).catch(err => console.error(err));
    const beerstyleEntries = await Beerentry.app.models.BeerstyleEntry.find({where: {beerId: id}, fields: {id: false}}).catch(err => console.error(err));
    const beerFromBreweryEntries = await Beerentry.app.models.BeerFromBreweryEntry.find({where: {beerId: id}, fields: {id: false}}).catch(err => console.error(err));

    // update beer
    const existingBeer = await Beerentry.app.models.Beer.findById(originalId).catch(err => console.error(err));
    beer = await existingBeer.updateAttributes(beerEntry.toJSON()).catch(err => console.error(err));

    // update related objects
    if (beerstyleEntries.length > 0) {
      // get original beerstyles
      const beerstyles = Beerentry.app.models.Beerstyle.find({where: {beerId: beer.id}, fields: {id: true}}).catch(err => console.error(err));

      // delete original beerstyles
      beerstyles.map(async beerstyle => {
        Beerentry.app.models.Beerstyle.deleteById(beerstyle.id).catch(err => console.error(err));
      });

      // create new beerstyles
      beerstyleEntries.map(async beerstyleEntry => {
        beerstyleEntry.beerId = beer.id;
        Beerentry.app.models.Beerstyle.create(beerstyleEntry).catch(err => console.error(err));
      });
    }
    if (beerFromBreweryEntries.length > 0) {
      // get original beerFromBreweries
      const beerFromBreweries = Beerentry.app.models.BeerFromBrewery.find({where: {beerId: beer.id}, fields: {id: true}}).catch(err => console.error(err));

      // delete original beerFromBreweries
      beerFromBreweries.map(async beerFromBrewery => {
        Beerentry.app.models.BeerFromBrewery.deleteById(beerFromBrewery.id).catch(err => console.error(err));
      });

      // create new beerFromBreweries
      beerFromBreweryEntries.map(async beerFromBreweryEntry => {
        beerFromBreweryEntry.beerId = beer.id;
        Beerentry.app.models.BeerFromBrewery.create(beerFromBreweryEntry).catch(err => console.error(err));
      });
    }
  };

  Beerentry.remoteMethod('updateBeer', {
    accepts: [
      {arg: 'id', type: 'number', required: true},
      {arg: 'originalId', type: 'number', required: true},
    ],
    http: {path: '/:id/updateBeer', verb: 'get'},
    returns: {type: 'object', root: true},
  });
};
