'use strict';

module.exports = function(Entry) {
  Entry.acceptEntry = async function(id, next) {
    const statusId = 2, current = 1;
    const entry = await Entry.findById(id, {include: ['beerEntry', 'breweryEntry', 'articleEntry']}).catch(err => console.error(err));
    console.log(entry);
    const activity = await Entry.app.models.Activity.findById(entry.activityId).catch(err => console.error(err));

    // check if entry exists
    if (!entry) {
      const err = new Error('Entry not found');
      err.statusCode = 404;
      err.code = 'ITEM_NOT_FOUND';
      return next(err);
    }

    // check which type of object is accepted
    const jsonEntry = entry.toJSON();

    if (jsonEntry.hasOwnProperty('beerEntry')) {
      let beer;
      if (activity.beerId === 0) {
        beer = await Entry.app.models.BeerEntry.createBeer(jsonEntry.beerEntry.id).catch(err => console.error(err));
        activity.beerId = beer.id;
      } else {
        beer = await Entry.app.models.BeerEntry.updateBeer(jsonEntry.beerEntry.id, activity.beerId).catch(err => console.error(err));
      }
    }

    if (jsonEntry.hasOwnProperty('breweryEntry')) {
      let brewery;
      if (activity.breweryId === 0){
        brewery = await Entry.app.models.BreweryEntry.createBrewery(jsonEntry.breweryEntry.id).catch(err => console.error(err));
        activity.breweryId = brewery.id;
      } else {
        brewery = await Entry.app.models.BreweryEntry.updateBrewery(jsonEntry.breweryEntry.id, activity.breweryId).catch(err => console.error(err));
      }
    }

    if (jsonEntry.hasOwnProperty('articleEntry')) {
      console.log('articleEntry');
    }

    // update entry
    entry.statusId = statusId;
    entry.current = current;
    entry.updateAttributes(entry).catch(err => console.error(err));

    // update activity
    activity.statusId = statusId;
    activity.updateAttributes(activity).catch(err => console.error(err));

    return entry;
  };

  Entry.remoteMethod('acceptEntry', {
    accepts: [
      {arg: 'id', type: 'number', required: true},
    ],
    http: {path: '/:id/acceptEntry', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });
};
