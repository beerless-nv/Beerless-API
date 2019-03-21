'use strict';

module.exports = function(Beerfrombrewery) {
  /**
   * Validation
   */
  Beerfrombrewery.validatesPresenceOf('beerId', 'breweryId');
  Beerfrombrewery.validatesNumericalityOf('isPublisher', 'beerId', 'breweryId');
};
