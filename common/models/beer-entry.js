'use strict';

module.exports = function(Beerentry) {
  /**
   * Validation
   */
  // Beerentry.validatesPresenceOf('beer.name', 'beer.ABV');
  // Beerentry.validatesNumericalityOf('ABV', 'IBU', 'EBC', 'temperature', 'since');
  function beerNameValidator(err, done) {
    console.log(this.name);
    Beerentry.find({where: {name: this.name}})
      .then(result => {
        console.log(result);
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
    if (!entryObject.action) next();

    // Create variables based on action
    if (entryObject.action === 'create') {
      activityTypeId = 1;
      beerId = 0;
      // Validate name
      Beerentry.validateAsync('name', beerNameValidator, {message: 'is not unique'});
    } else {
      // Check if entryObject contains originalId
      if (!entryObject.originalId) next();
      activityTypeId = 2;
      beerId = entryObject.originalId;
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
    const activityId = (await Beerentry.app.models.Activity.create(activity)).id;

    // Create entry
    const entry = {
      current: 0,
      statusId: statusId,
      activityId: activityId,
    };
    const entryId = (await Beerentry.app.models.Entry.create(entry)).id;

    // Update BeerEntry object
    ctx.req.body.entryId = entryId;

    next();
  });

  Beerentry.afterRemote('create', async function(ctx, modalInstance, next) {
    console.log('AFTERREMOTE EXECUTED');

    const beer = modalInstance;

    // Create beerstyles
    if (beer.beerstyles && beer.beerstyles.length > 0) {
      beer.beerstyles.map(beerstyle => {
        const beerstyleEntry = {
          beerId: beer.id,
          styleTagId: beerstyle.styleTagId,
        };
        Beerentry.app.models.BeerstyleEntry.create(beerstyleEntry).then(data => console.log(data)).catch(err => console.log(err));
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
        Beerentry.app.models.BeerFromBreweryEntry.create(beerFromBreweryEntry).then(data => console.log(data)).catch(err => console.log(err));
      });
    }

    // // Update activity if action is create
    // if (beer.action === 'create') {
    //   const activityId = (await Beerentry.app.models.Entry.findById(beer.entryId)).activityId;
    //   const activity = await Beerentry.app.models.Activity.findById(activityId);
    //   activity.updateAttribute('beerId', beer.id, next());
    // }

    next();
  });

  /**
   * Remote hook for the approval system.
   * The hook makes sure the entries from users are updated correctly and
   * previous entries are archived.
   */
  Beerentry.afterRemote('replaceById', async function(ctx, modalInstance, next) {

    // breweries en styletags ook inladen en vernieuwen
    // check nieuwste versies van breweries en neem die Id

    switch (modalInstance.statusId) {
      case 2:
        // Update previous versions of the beer
        if (modalInstance.originalId !== 0) {
          const previousVersions = await Beer.find({where: {or: [{id: modalInstance.originalId}, {originalId: modalInstance.originalId}]}});

          previousVersions.map(beer => {
            if (beer.statusId !== 2 && beer.statusId !== 5 && beer.id !== modalInstance.id) {
              beer.updateAttribute('statusId', 5, function(err, resp) {
                if (err) {
                }
                if (resp) {
                }
              });
            }
          });
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
};
