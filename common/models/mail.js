'use strict';

module.exports = function(Mail) {

  /**
   * Send email from user to beerless.
   *
   * @returns {Promise<string>}
   */
  Mail.sendMail = async function(data, next) {
    //TODO: methode beveiligen
    if (!data || (!data.firstName || !data.lastName || !data.email || !data.message)) {
      const err = new Error();
      err.statusCode = 400;
      err.message = 'Please make sure all fields are filled in!';
      err.code = 'REQUIRED_FIELDS_NOT_COMPLETE';
      next(err);
      return;
    }

    Mail.app.models.Email.send({
      to: process.env.NOREPLY_EMAIL,
      from: {
        name: data.firstName + ' ' + data.lastName,
        email: data.email,
      },
      subject: 'Message from ' + data.firstName + ' ' + data.lastName,
      text: 'Message',
      html: data.message
    }, function(err, result) {
      if (err) {
        const err = new Error();
        err.statusCode = 400;
        err.message = 'Something went wrong, please try again!';
        err.code = 'EMAIL_NOT_SENT';
        return err;
      }
    });

    return;
  };

  Mail.remoteMethod('sendMail', {
    accepts: [
      {arg: 'data', type: 'object', http: {source: 'body'}, required: true},
    ],
    returns: {type: 'object', root: true},
    http: {path: '/sendMail', verb: 'post'},
  });
};
