'use strict';

module.exports = function(Breweryentry) {


  /**
   {
  "action":"create",
  "name": "string",
  "description": "string",
  "country": "string",
  "province": "string",
  "place": "string",
  "postcode": "string",
  "streetAndNumber": "string",
  "logo": "beer-no-logo.svg",
  "entryId": 0,
  "contact":{
    "website":"www.google.com",
    "twitter":"test",
    "facebook":"www.facebook.com",
    "instagram":"test"
  },
  "timestampCreated": "2019-08-20T12:06:21.582Z",
  "timestampUpdated": "2019-08-20T12:06:21.582Z"
}
   */


    /**
   * User entries for breweries
   * Remote hooks for create method which is used both for new entries
   * and update entries.
   * The hooks validate the entries and create activities, entries and related
   * objects.
   */
  Breweryentry.beforeRemote('create', async function(ctx, modelInstance, next) {
    let activityTypeId, breweryId;
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
      activityTypeId = 3;
      breweryId = 0;
      // Validate name
      //TODO!!!!!!!!!!
      //Breweryentry.validateAsync('name', beerNameValidator, {message: 'is not unique'});
    } else if (entryObject.action === 'update') {
      // Check if entryObject contains originalId
      if (!entryObject.originalId) {
        const err = new Error('OriginalId is missing');
        err.statusCode = 404;
        err.code = 'PROPERTY_MISSING';
        return next(err);
      }
      activityTypeId = 4;
      breweryId = entryObject.originalId;
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
      beerId: 0,
      breweryId: breweryId,
      statusId: statusId,
    };
    const activityId = (await Breweryentry.app.models.Activity.create(activity).catch(err => console.error(err))).id;

    // Create entry
    const entry = {
      current: 0,
      statusId: statusId,
      activityId: activityId,
    };
    const entryId = (await Breweryentry.app.models.Entry.create(entry).catch(err => console.error(err))).id;

    // Update BeerEntry object
    ctx.req.body.entryId = entryId;

    next();
  });

  Breweryentry.afterRemote('create', async function(ctx, modalInstance, next) {
    const brewery = modalInstance;

    // Create contact
    if (brewery.contact) {
        brewery.contact.breweryId = brewery.id;
        Breweryentry.app.models.ContactEntry.create(brewery.contact).then(data => console.log(data)).catch(err => console.error(err));
    }

    next();
  });

    /**
   * The brewery entry is accepted and is being created.
   *
   * @param id
   * @returns {Promise<T | void>}
   */
  Breweryentry.createBrewery = async function(id) {
    let brewery;
    const breweryEntry = await Breweryentry.findById(id, {fields: {id: false}}).catch(err => console.error(err));
    const contactEntry = await Breweryentry.app.models.ContactEntry.find({where: {breweryId: id}, fields: {id: false}}).catch(err => console.error(err));
    console.log(contactEntry);

    // create brewery
    brewery = await Breweryentry.app.models.Brewery.create(breweryEntry).catch(err => console.error(err));

    // create new related objects
    contactEntry.breweryId = brewery.id;
    Breweryentry.app.models.Contact.create(contactEntry).catch(err => console.error(err));

    return brewery;
  };

  Breweryentry.remoteMethod('createBrewery', {
    accepts: [
      {arg: 'id', type: 'number', required: true},
    ],
    http: {path: '/:id/createBrewery', verb: 'get'},
    returns: {type: 'object', root: true},
  });

  /**
   * The brewery entry is accepted and is being updated.
   *
   * @param id
   * @param originalId
   * @returns {Promise<T | void>}
   */
  Breweryentry.updateBrewery = async function(id, originalId) {
    let brewery;
    const breweryEntry = await Breweryentry.findById(id, {fields: {id: false, timestampCreated: false}}).catch(err => console.error(err));
    const contactEntry = await Breweryentry.app.models.ContactEntry.find({where: {breweryId: id}, fields: {id: false}}).catch(err => console.error(err));

    // update brewery
    const existingBrewery = await Breweryentry.app.models.Brewery.findById(originalId).catch(err => console.error(err));
    brewery = await existingBrewery.updateAttributes(breweryEntry.toJSON()).catch(err => console.error(err));


    // Update contact
    // Get original contact
    const contact = Breweryentry.app.models.Contact.find({where: {breweryId: brewery.id}, fields: {id: true}}).catch(err => console.error(err));
    
    // Delete original contact
    Breweryentry.app.models.Contact.deleteById(contact.id).catch(err => console.error(err));
    
    // Create new contact
    contactEntry.breweryId = brewery.id;
    Breweryentry.app.models.Contact.create(contactEntry).catch(err => console.error(err));

  };

  Breweryentry.remoteMethod('updateBrewery', {
    accepts: [
      {arg: 'id', type: 'number', required: true},
      {arg: 'originalId', type: 'number', required: true},
    ],
    http: {path: '/:id/updateBrewery', verb: 'get'},
    returns: {type: 'object', root: true},
  });
};
