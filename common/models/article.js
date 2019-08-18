'use strict';

const LoopBackContext = require('loopback-context');
module.exports = function(Article) {
  /**
   * Validation
   */
  Article.validatesPresenceOf('userId');
  Article.validatesUniquenessOf('title', 'slug');


  /**
   * User entries for articles
   *
   * @param data
   * @returns {Promise<void>}
   */
  Article.articleEntry = async function(data) {
    // check if isApproved exists
    if (!data['isApproved']) {
      data['isApproved'] = 0;

      // get userId
      const ctx = LoopBackContext.getCurrentContext();
      const userId = (ctx && ctx.get('currentUser')).id;

      // define activityType
      let articleId = data['id'];
      let activityTypeId = 5;
      if (data['id']) {
        data['id'] = null;
        activityTypeId = 6;
      }

      // insert article object in db
      const article = await Article.create(data).catch(err => console.log(err));

      // add activity for the insert
      const activity = {
        'timestampCreated': '1970-01-01T00:00:00.000Z',
        'timestampUpdated': '1970-01-01T00:00:00.000Z',
        'breweryId': 0,
        'beerId': 0,
        'articleId': article.id,
        'userId': userId,
        'activityTypeId': activityTypeId,
        'originalId': articleId,
        'isApproved': 0,
      };

      Article.app.models.Activity.create(activity);

      return article;
    }
  };

  Article.remoteMethod('articleEntry', {
    accepts: {
      arg: 'data',
      type: 'object',
      http: {source: 'body'},
      required: true,
    },
    returns: {type: 'object', root: true},
    http: {path: '/articleEntry', verb: 'post'},
  });
};
