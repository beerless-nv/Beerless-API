'use strict';

module.exports = function(Tastingprofile) {
  /**
   * Validation
   */
  Tastingprofile.validatesPresenceOf('beerId', 'userId');
  Tastingprofile.validatesNumericalityOf('malty', 'sweet', 'sour', 'hoppy', 'bitter', 'fruity');

  /**
   * Get the average tastingprofiles of all beers.
   *
   * Combines the entries with the same beerId and averages the tasting
   * characteristic columns.
   *
   * @param data
   * @returns {Promise<void>}
   */

  Tastingprofile.getAllAverages = async function() {
    // create sql query
    const query = "SELECT ID, SUM(malty * weight) / SUM(weight) AS malty, SUM(sweet * weight) / SUM(weight) AS sweet, SUM(sour * weight) / SUM(weight) AS sour, SUM(hoppy * weight) / SUM(weight) AS hoppy, SUM(bitter * weight) / SUM(weight) AS bitter, SUM(fruity * weight) / SUM(weight) AS fruity, beerID AS beerId FROM Tastingprofile GROUP BY beerID";

    // define datasource
    const ds = Tastingprofile.dataSource;

    // execute query on database
    return new Promise(resolve => {
      ds.connector.query(query, function(err, result) {
        resolve(result);
      });
    });
  };

  Tastingprofile.remoteMethod('getAllAverages', {
    returns: {type: 'object', root: true},
    http: {path: '/averages', verb: 'get'},
  });


  /**
   * Get the average tastingprofiles of a single beer.
   *
   * Averages the tasting characteristic columns.
   *
   * @param id
   * @returns {Promise<void>}
   */

  Tastingprofile.getAverages = async function(id) {
    // catch beerId from request param
    const beerId = id;

    // create sql query
    const query = "SELECT ID, AVG(malty) AS malty, AVG(sweet) AS sweet, AVG(sour) AS sour, AVG(hoppy) AS hoppy, AVG(bitter) AS bitter, AVG(fruity) AS fruity, beerID AS beerId FROM Tastingprofile WHERE beerID = ?";

    // define datasource
    const ds = Tastingprofile.dataSource;

    // execute query on database
    let resultQuery = new Promise(resolve => {
      ds.connector.query(query, [beerId], function(err, result) {
        resolve(result);
      });
    });

    return resultQuery;
  };

  Tastingprofile.remoteMethod('getAverages', {
    accepts: {
      arg: 'id',
      type: 'number',
      required: true,
    },
    http: {path: '/averages/:id', verb: 'get'},
    returns: {type: 'object', root: true},
  });
};
