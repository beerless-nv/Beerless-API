'use strict';

const axios = require('axios');

module.exports = function(Beerstyle) {
  /**
   * Validation
   */
  Beerstyle.validatesPresenceOf('styleTagId', 'beerId');
  Beerstyle.validatesNumericalityOf('styleTagId', 'beerId');
};
