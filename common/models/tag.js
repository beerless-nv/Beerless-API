'use strict';

module.exports = function(Tag) {
  /**
   * Validation
   */
  Tag.validatesUniquenessOf('name');
};
