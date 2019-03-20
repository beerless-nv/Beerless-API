'use strict';

const LoopBackContext = require('loopback-context');
module.exports = function(Beer) {
  Beer.beerEntry = async function(data) {
    // check if isApproved exists
    if (!data['isApproved']) {
      data['isApproved'] = 0;

      // get userId
      const ctx = LoopBackContext.getCurrentContext();
      const userId = (ctx && ctx.get('currentUser')).id;

      // define activityType
      let beerId = data['id'];
      let activityTypeId = 1;
      if (data['id']) {
        data['id'] = null;
        activityTypeId = 2;
      }

      // insert beer object in db
      const beer = await Beer.create(data);

      // add activity for the insert
      const activity = {
        'timestampCreated': '1970-01-01T00:00:00.000Z',
        'timestampUpdated': '1970-01-01T00:00:00.000Z',
        'breweryId': 0,
        'beerId': beer.id,
        'articleId': 0,
        'userId': userId,
        'activityTypeId': activityTypeId,
        'originalId': beerId,
        'isApproved': 0,
      };

      Beer.app.models.Activity.create(activity);

      return beer;
    }
  };

  Beer.remoteMethod('beerEntry', {
    accepts: {
      arg: 'data',
      type: 'object',
      http: {source: 'body'},
      required: true,
    },
    http: {path: '/beerEntry', verb: 'post'},
    returns: {type: 'object', root: true},
  });

  Beer.itemBasedRecommendation = async function(beerId, amount, res) {
    console.log('beerId', beerId);
    console.log('amount', amount);

    // const spawn = require('child_process').spawn;
    // const process = spawn('python', ['./../../extra_scripts/UseModel.py', beerId, amount]);
    //
    // process.stdout.on('data', function(data) {
    //   res.send(data.toString());
    //   console.log(data);
    // });


    const options = {
      args:
        [
          beerId, // starting funds
          amount, // (initial) wager size
        ]
    };

    const PythonShell = require('python-shell');
    //you can use error handling to see if there are any errors
    PythonShell.PythonShell.run('.\\..\\python\\UseModel.py', options, function (err, results) {
    //your code
      console.log(err);
      console.log(results);
    });

  };

  Beer.remoteMethod('itemBasedRecommendation', {
    accepts: [
      {arg: 'beerId', type: 'number', required: true},
      {arg: 'amount', type: 'number', required: true},
    ],
    http: {path: '/itemBasedRecommendation', verb: 'get'},
    returns: {type: 'object', root: true},
  });
};
