'use strict';

module.exports = function(Usersocial) {
  /**
   * Validation
   */
  Usersocial.validatesPresenceOf('socialId', 'userId');
  Usersocial.validatesNumericalityOf('socialId', 'userId');
};
