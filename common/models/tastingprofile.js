'use strict';

module.exports = function(Tastingprofile) {

  /**
   * Get the average tastingprofiles of a single beer.
   *
   * Averages the tasting characteristic columns.
   *
   * @param data
   * @returns {Promise<void>}
   */

  Tastingprofile.averages = async function(data) {
    // create sql query
    const query = 'SELECT * FROM Tastingprofile';
    // const sql_stmt = "SELECT ID, AVG(malty), AVG(sweet), AVG(sour), AVG(hoppy), AVG(bitter), AVG(fruity), userID, beerID FROM Tastingprofile GROUP BY beerID";

    // define datasource
    const ds = Tastingprofile.dataSource;

    // execute query on database
    let resultQuery = null;
    resultQuery = new Promise(resolve => {
      ds.connector.query(query, function(err, result) {
        resolve(result);
      });
    });

    return resultQuery;
  };

  Tastingprofile.remoteMethod('averages', {
    accepts: {
      arg: 'data',
      type: 'number',
      required: true,
    },
    returns: {type: 'object', root: true},
    http: {path: '/averages/{id}', verb: 'get'},
  });

  /**
   * Get the average tastingprofiles of all beers.
   *
   * Combines the entries with the same beerId and averages the tasting
   * characteristic columns.
   *
   * @param data
   * @returns {Promise<void>}
   */

  Tastingprofile.averages = async function() {
    // create sql query
    const query = "SELECT ID, AVG(malty) AS malty, AVG(sweet) AS sweet, AVG(sour) AS sour, AVG(hoppy) AS hoppy, AVG(bitter) AS bitter, AVG(fruity) AS fruity, userID, beerID FROM Tastingprofile GROUP BY beerID";

    // define datasource
    const ds = Tastingprofile.dataSource;

    // execute query on database
    let resultQuery = null;
    resultQuery = new Promise(resolve => {
      ds.connector.query(query, function(err, result) {
        resolve(result);
      });
    });

    return resultQuery;
  };

  Tastingprofile.remoteMethod('averages', {
    returns: {type: 'object', root: true},
    http: {path: '/averages', verb: 'get'},
  });
};
