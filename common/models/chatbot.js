'use strict';

const axios = require('axios');

module.exports = function (Chatbot) {

    /**
     * Cron job to retrain chatbot
     * 
     * @param chatbotID
     */
    Chatbot.retrain = async function (req, next) {
        // check header
        if (req.get('x-appengine-cron') !== 'true') {
            //401 ERROR Message
            const err = new Error();
            err.statusCode = 401;
            err.message = 'Authorization Required';
            err.code = 'AUTHORIZATION_REQUIRED';
            next(err);
            return;
        }

        //Variables
        const baseUri = 'https://admin-api-acc.oswald.ai/api/v1';
        const chatbotId = '5cb49d7d4648730006815d8d';

        //Login first
        let credentials = {
            "email": "info@beerless.be",
            "password": "sselreeB1998"
        };

        //get login access token
        const login = (await axios.post(baseUri + "/users/login", credentials))['data'];

        const params = {
            'access_token': login['id']
        }

        //POST request to retrain chatbot
        axios.post(baseUri + '/chatbots/' + chatbotId + '/move-to-production', {}, { params: params }).catch(err => console.log(err));

        //Return
        return true;
    };

    Chatbot.remoteMethod('retrain', {
        accepts: [
            { arg: 'req', type: 'object', 'http': { source: 'req' } }
        ],
        http: { path: '/retrain', verb: 'get' },
        returns: { type: 'boolean', root: true },
    });

};