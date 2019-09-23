/*
    Social login from SLACK
*/

var router = require('express').Router();
var CONFIG = require("../config/config");
var LIBAUTH = require("../lib/libauth");
const https = require('https');
/*const bodyParser = require('body-parser');
router.use(bodyParser.urlencoded({ extended: true }));
*/

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
        locataire : CONFIG.AUTH.AZURE.tenant_id,
        client_id : CONFIG.AUTH.AZURE.client_id,
        response_type : "code",
        redirect_uri : CONFIG.AUTH.AZURE.redirect_uri,
        response_mode : "query",
        nonce : "JULIEN"
    };
    res.send( {
        auth_url : "https://login.microsoftonline.com/" + CONFIG.AUTH.AZURE.tenant_id + "/oauth2/authorize?" + Object.keys(query_params).map(p => {return p + "=" + encodeURIComponent(query_params[p]);}).join("&"),
        nonce : "JULIEN"
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
    try {
        var query_params_obj = {
            code : req.query.code,
            grant_type : "authorization_code",
            locataire : CONFIG.AUTH.AZURE.tenant_id,
            client_id : CONFIG.AUTH.AZURE.client_id,
            client_secret : CONFIG.AUTH.AZURE.client_secret,
            redirect_uri : CONFIG.AUTH.AZURE.redirect_uri
        };        
        var form_datas_array=[];
        Object.keys(query_params_obj).forEach(att => {
            form_datas_array.push(att +"="+query_params_obj[att]);
        });
        form_datas = form_datas_array.join("&");

        var authReply={};
        var options = {
            host: CONFIG.AUTH.AZURE.host,
            path: CONFIG.AUTH.AZURE.path,
            port: 443,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': form_datas.length
            }
        };         
        // must check scope against SLACK
        const slackreq = https.request( options, (azure_reply) => {
            const { statusCode } = azure_reply;
            const contentType = azure_reply.headers['content-type'];
            let error;
             if (!/^application\/json/.test(contentType)) {
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
                if (statusCode !== 200) {
                    error = new Error('Request Failed.\n' +
                                    `Status Code: ${statusCode}`);
                    console.log(error);
                    res.redirect('/#authentication_failed');
                    return;
                }
    /*
                console.log(rawData);
                console.log("----JSONIFY----");*/
                authReply = JSON.parse(rawData);
                //console.log(authReply);
                // getUserFrom IDToken
                var temp = JSON.parse(require('atob')(authReply.id_token.split(".")[1]));

                var username = temp.name;

                if ( authReply.expires_in ){
                    res.cookie('karch_session', LIBAUTH.getAccessToken(), { maxAge: 60*1000*120, httpOnly: false });
                    res.redirect('/'+req.query["state"] || "");
                } else {
                    // invalid access code
                    res.redirect('/#authentication_failed');
                }
                // Added to redirect to right page 
                //res.redirect('/');
            });
        });
        slackreq.on('error', (e) => {
            console.error(`Got error: ${e.message}`);
            // don't do anything here... would cause ECONNRESET and crash
            res.redirect('/#authentication_failed');
        });
        slackreq.write(form_datas);
        slackreq.end();        
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
