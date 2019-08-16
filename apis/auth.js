/*
    Social login from SLACK
*/

var router = require('express').Router();
var CONFIG = require("../config/config");
var LIBAUTH = require("../lib/libauth");
const https = require('https');

/********************* */
router.get('/checksession',  (req, res, next) => {
    if (LIBAUTH.checkAccessToken(req.param("karch_session")) ) {
        res.send({ok : true});
    } else {
        res.send({ok : false});
    }
});
router.get('/fromslack',  (req, res, next) => {
    var query_params ={};
    query_params.code= req.param("code");
    query_params.client_id = CONFIG.AUTH.SLACK.client_id;
    query_params.client_secret = CONFIG.AUTH.SLACK.client_secret;
    query_params.redirect_uri = CONFIG.AUTH.SLACK.redirect_uri;
    var slack_path = CONFIG.AUTH.SLACK.path ;
    Object.keys(query_params).forEach( k =>{
        slack_path += k + "=" + encodeURI(query_params[k]) + "&";
    });

    var authReply={};
    // must check scope against SLACK
    const slackreq = https.get(slack_path, (slack_reply) => {
        const { statusCode } = slack_reply;
        const contentType = slack_reply.headers['content-type'];
        let error;
        if (statusCode !== 200) {
            error = new Error('Request Failed.\n' +
                              `Status Code: ${statusCode}`);
        } else if (!/^application\/json/.test(contentType)) {
            error = new Error('Invalid content-type.\n' +
                              `Expected application/json but received ${contentType}`);
        }
        if (error) {
            console.error(error.message);
            // Consume response data to free up memory
            slack_reply.resume();
            return;
        }

        slack_reply.setEncoding('utf8');
        let rawData = '';
        slack_reply.on('data', (chunk) => {rawData += chunk;});
        slack_reply.on('end', () => {
            try {
              authReply = JSON.parse(rawData);
              console.log(authReply);
              checkSlackAnswer(authReply, res);
            } catch (e) {
              console.error(e.message);
            }
        });
    }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
    });
});


/********************* */
router.get('/fromslack2',  (req, res, next) => {
    var query_params ={};
    query_params.code= req.param("code");
    query_params.client_id      = CONFIG.AUTH.SLACK.client_id;
    query_params.client_secret  = CONFIG.AUTH.SLACK.client_secret;
    query_params.redirect_uri   = CONFIG.AUTH.SLACK.redirect_uri;
    var slack_path              = CONFIG.AUTH.SLACK.path ;
    Object.keys(query_params).forEach( k =>{
        slack_path += k + "=" + encodeURI(query_params[k]) + "&";
    });

    var authReply={};
    // must check scope against SLACK
    const slackreq = https.get(slack_path, (slack_reply) => {
        const { statusCode } = slack_reply;
        const contentType = slack_reply.headers['content-type'];
        let error;
        if (statusCode !== 200) {
            error = new Error('Request Failed.\n' +
                              `Status Code: ${statusCode}`);
        } else if (!/^application\/json/.test(contentType)) {
            error = new Error('Invalid content-type.\n' +
                              `Expected application/json but received ${contentType}`);
        }
        if (error) {
            console.error(error.message);
            // Consume response data to free up memory
            slack_reply.resume();
            return;
        }

        slack_reply.setEncoding('utf8');
        let rawData = '';
        slack_reply.on('data', (chunk) => {rawData += chunk;});
        slack_reply.on('end', () => {
            try {
                authReply = JSON.parse(rawData);
                console.log(authReply);
                if (authReply.ok == true){
                    res.cookie('karch_session', LIBAUTH.getAccessToken(), { maxAge: 60*1000*120, httpOnly: false});
                }
                res.redirect('/');
            } catch (e) {
              console.error(e.message);
            }
        });
    }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
    });
});

function checkSlackAnswer(reply, res){
    if (reply.ok == true){
        // Forge access_token with limited timespan.
        res.send({access_token : LIBAUTH.getAccessToken(), user : reply.user.name});
    }
    else res.send("KO");
}

module.exports = router;
