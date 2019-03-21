'use strict';

module.exports = function(Styletagcategory) {
  /**
   * Validation
   */
  Styletagcategory.validatesUniquenessOf('name');
};
