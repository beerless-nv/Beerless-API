'use strict';

module.exports = function(Relationship) {
  /**
   * Validation
   */
  Relationship.validatesPresenceOf('statusId', 'user1Id', 'user2Id', 'actionUserId');
  Relationship.validatesNumericalityOf('statusId', 'user1Id', 'user2Id', 'actionUserId');
};
