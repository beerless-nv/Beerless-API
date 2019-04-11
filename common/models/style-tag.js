'use strict';

const axios = require('axios');

module.exports = function(Styletag) {
  /**
   * Validation
   */
  Styletag.validatesUniquenessOf('name');
  Styletag.validatesPresenceOf('styletagCategoryId');
  Styletag.validatesNumericalityOf('styletagCategoryId');

  /**
   * Uploads all styletags to the entitylabel styletag_list in Oswald.
   *
   * @returns {Promise<boolean>}
   */
  Styletag.uploadEntities = async function() {
    // variables
    const styletags = await Styletag.find();
    const chatbotId = '5c909b61ccc52e00050a6e76';
    const baseUri = 'https://admin-api.oswald.ai/api/v1';
    const entityLabelId = '5ca5abec696d2900055a1dbc';
    const params = {
      'access_token': 'NEjjJgDwVTx4g7biimfuHobQixgtPWriJHYgq9ZXNwgi9V3ZddCA4gOBPWb0VFcb',
    };
    const payload = {
      'label': 'beerstyle_list',
      'useForCorrections': true,
      'chatbotId': chatbotId,
    };

    for (const styletag of styletags) {
      const payload = {
        'value': {
          'en': styletag['name'],
        },
        'synonyms': [],
        'useForCorrections': true,
        'chatbotId': chatbotId,
      };

      const result = await axios.post(baseUri + '/entity-labels/' + entityLabelId + '/values', payload, {params: params});
    }

    return true;
  };

  Styletag.remoteMethod('uploadEntities', {
    http: {path: '/uploadEntities', verb: 'get'},
    returns: {type: 'boolean', root: true},
  });
};
