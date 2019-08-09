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
   * {
  "action": "create",
  "beer": {
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
    "timestampCreated": "2019-08-09T13:37:52.653Z",
    "timestampUpdated": "2019-08-09T13:37:52.653Z",
    "beerFromBreweries": [
      {
        "isPublisher": 1,
        "beerId": 0,
        "timestampCreated": "2019-08-09T13:37:52.804Z",
        "timestampUpdated": "2019-08-09T13:37:52.804Z",
        "breweryId": 222
      }
    ],
    "beerstyles": [
      {
        "styleTagId": 4,
        "beerId": 0,
        "timestampCreated": "2019-08-09T13:37:53.439Z",
        "timestampUpdated": "2019-08-09T13:37:53.439Z"
      }
    ]
  }
}
   */

  /**
   * User entries for beers
   * Remote hooks for create method which is used both for new entries
   * and update entries.
   * The hooks set a statusId and create a new activity for the user.
   */
  Beerentry.beforeRemote('create', async function(ctx, modelInstance, next) {
    let activityTypeId, beerId, beer;
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
    delete ctx.req.body.action;

    next();
  });

  Beerentry.afterRemote('create', async function(ctx, modalInstance, next) {
    // create beerstyle and beerFromBrewery object
    console.log(modalInstance);
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
