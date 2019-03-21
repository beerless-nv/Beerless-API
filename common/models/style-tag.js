'use strict';

module.exports = function(Styletag) {
  /**
   * Validation
   */
  Styletag.validatesUniquenessOf('name');
  Styletag.validatesPresenceOf('styleTagCategoryId');
  Styletag.validatesNumericalityOf('styleTagCategoryId');
};
