const CONFIG= {
    PORT : 80,
    HTTPS : {
        ca : "/PATH_TO/chain.pem", 
        cert : "/PATH_TO/cert.pem", 
        private_key : "/PATH_TO/privkey.pem" 
    },
    AT_PWD : "CHOSE A RANDOM PASSWORD FOR CRYPTING KARCHNOETOKEN",
    AUTH : {
        DISABLE : false, // set it to true for no AUTH at all.
        AT_DURATION : 14400, //in sec
        SLACK : {
            path : "https://a-cms.slack.com/api/oauth.access?",
            client_id :  "GIVE_IT",
            client_secret: "",
            team_check : true, // wether team ID will be checked
            team_id : "GIVE_IT", // Represents the ACMS TEAM the user
            redirect_uri: "http://GIVE_IT/auth/fromslack2"
        },
        AZURE : {
            path : "https://login.microsoftonline.com/MY_TENANT_ID/oauth2/v2.0/authorize??",
            client_id :  "GIVE_IT",
            client_secret: "",
            redirect_uri: "http://GIVE_IT/auth/fromslack2",
            scope : "openid",
            tenant_id: "AZURE_TENANT_ID"
        }
    }
}
module.exports = CONFIG;