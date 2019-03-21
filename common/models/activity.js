'use strict';

module.exports = function(Activity) {
  /**
   * Validation
   */
  // required check for FK's
  Activity.validatesPresenceOf('activityTypeId', 'userId');
  Activity.validatesNumericalityOf('activityTypeId', 'userId', 'articleId', 'beerId', 'breweryId', 'originalId', 'isApproved');
  // Activity.validatesLengthOf('isApproved', {max: 1});
};
