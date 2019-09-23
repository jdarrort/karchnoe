/*
    Social login from SLACK
*/

var router = require('express').Router();
var CONFIG = require("../config/config");
var LIBAUTH = require("../lib/libauth");
const https = require('https');


/********************* */
router.get('/slackauthparams',  (req, res, next) => {
    // query params
    var query_params = {
        scope : "identity.basic",
        client_id : CONFIG.AUTH.SLACK.client_id,
        team_id : CONFIG.AUTH.SLACK.team_id,
        redirect_uri : CONFIG.AUTH.SLACK.redirect_uri

    };
    res.send({
        auth_url : "https://a-cms.slack.com/oauth/authorize?scope=identity.basic&client_id="+ Object.keys(query_params).map(p => {return p + "=" + encodeURIComponent(query_params[p]);}).join("&")
    });
})



/********************* */
router.get('/azureauthparams',  (req, res, next) => {
    // query params
    var query_params = {
        scope : CONFIG.AUTH.AZURE.scope,
        client_id : CONFIG.AUTH.AZURE.client_id/*,
        redirect_uri : CONFIG.AUTH.AZURE.redirect_uri*/

    };
    res.send( {
        auth_url : "https://login.microsoftonline.com/" + CONFIG.AUTH.AZURE.tenant_id + "/oauth2/v2.0/authorize?" + Object.keys(query_params).map(p => {return p + "=" + encodeURIComponent(query_params[p]);}).join("&")
    });
})



/********************* */
router.get('/checksession',  (req, res, next) => {
    if (LIBAUTH.checkAccessToken(req.query["karch_session"]) ) {
        res.send({ok : true});
    } else {
        res.send({ok : false});
    }
});

/********************* */
router.get('/fromazure',  (req, res, next) => {
    console.log(req.query);
    try {
        var query_params_obj = {
            code : req.query["code"],
            client_id : CONFIG.AUTH.AZURE.client_id,
            client_secret : CONFIG.AUTH.AZURE.client_secret,
            redirect_uri : CONFIG.AUTH.AZURE.redirect_uri
        };        
        var azure_path = CONFIG.AUTH.AZURE.path  + Object.keys(query_params_obj).map(p => {
            return p + "=" + encodeURIComponent(query_params_obj[p]);
        }).join("&");

        var authReply={};
        // must check scope against SLACK
        const slackreq = https.get(azure_path, (azure_reply) => {
            const { statusCode } = azure_reply;
            const contentType = azure_reply.headers['content-type'];
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
                azure_reply.resume();
                return;
            }

            azure_reply.setEncoding('utf8');
            let rawData = '';
            azure_reply.on('data', (chunk) => {rawData += chunk;});
            azure_reply.on('end', () => {
            authReply = JSON.parse(rawData);
            console.log(authReply);

            if (authReply.ok == true){
                res.cookie('karch_session', LIBAUTH.getAccessToken(), { maxAge: 60*1000*120, httpOnly: false });
                res.redirect('/'+req.param("state") || "");
            } else {
                // invalid access code
                res.redirect('/#authentication_failed');
            }
            // Added to redirect to right page 
            //res.redirect('/');
            });
        }).on('error', (e) => {
            console.error(`Got error: ${e.message}`);
            // don't do anything here... would cause ECONNRESET and crash
        });
    }
    catch (e){
        console.error(e.message);
        res.redirect('/#authentication_failed');
        return;
    }

});
/********************* */
router.get('/fromslack2',  (req, res, next) => {
    try {
        var query_params_obj = {
            code : req.query["code"],
            client_id : CONFIG.AUTH.SLACK.client_id,
            client_secret : CONFIG.AUTH.SLACK.client_secret,
            redirect_uri : CONFIG.AUTH.SLACK.redirect_uri
        };        
        var slack_path = CONFIG.AUTH.SLACK.path  + Object.keys(query_params_obj).map(p => {
            return p + "=" + encodeURIComponent(query_params_obj[p]);
        }).join("&");

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
            authReply = JSON.parse(rawData);
            console.log(authReply);

            if (authReply.ok == true){
                if( CONFIG.AUTH.SLACK.team_check ){
                    // Check team id of authenticated slack user
                    if (authReply.team.id != CONFIG.AUTH.SLACK.team_id) {
                        console.warn("Team check Failed : " + authReply.team.id);
                        res.redirect('/#authentication_failed_invalid_team');
                        return;
                    } else {
                        console.log("TeamId check OK");
                    }
                }
                res.cookie('karch_session', LIBAUTH.getAccessToken(), { maxAge: 60*1000*120, httpOnly: false});
                res.redirect('/'+req.param("state") || "");
            } else {
                // invalid access code
                res.redirect('/#authentication_failed');
            }
            // Added to redirect to right page 
            //res.redirect('/');
            });
        }).on('error', (e) => {
            console.error(`Got error: ${e.message}`);
            // don't do anything here... would cause ECONNRESET and crash
        });
    }
    catch (e){
        console.error(e.message);
        res.redirect('/#authentication_failed');
        return;
    }

});
/*
function checkSlackAnswer(reply, res){
    if (reply.ok == true){
        // Forge access_token with limited timespan.
        res.send({access_token : LIBAUTH.getAccessToken(), user : reply.user.name});
    }
    else res.send("KO");
}
*/
module.exports = router;
