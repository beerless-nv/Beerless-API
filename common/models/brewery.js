'use strict';

module.exports = function(Brewery) {
  Brewery.breweryEntry = async function(data) {
    if (!data['isApproved']) {
      data['isApproved'] = 0;
      Brewery.create(data);
      Activity.create()
      return data;
    }
  };

  Brewery.remoteMethod('breweryEntry', {
    accepts: {arg: 'data', type: 'object', http: {source: 'body'}, required: true},
    returns: {type: 'object', root: true},
    http: {path: '/breweryEntry', verb: 'post'},
  });
};
