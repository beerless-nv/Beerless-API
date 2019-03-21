'use strict';

module.exports = function(Contact) {
  /**
   * Validation
   */
  Contact.validatesPresenceOf('breweryId');
  Contact.validatesNumericalityOf('breweryId');
};
