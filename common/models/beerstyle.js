'use strict';

module.exports = function(Beerstyle) {
  /**
   * Validation
   */
  Beerstyle.validatesPresenceOf('styleTagId', 'beerId');
  Beerstyle.validatesNumericalityOf('styleTagId', 'beerId');
};
