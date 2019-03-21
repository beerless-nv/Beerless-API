'use strict';

module.exports = function(Articletag) {
  /**
   * Validation
   */
  Articletag.validatesPresenceOf('articleId', 'tagId');
  Articletag.validatesNumericalityOf('articleId', 'tagId');
};
