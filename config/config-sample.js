const CONFIG= {
    PORT : 80,
    AT_PWD : "CHOSE A RANDOM PASSWORD FOR CRYPTING KARCHNOETOKEN",
    AUTH : {
        DISABLE : false, // set it to true for no AUTH at all.
        SLACK : {
            path : "https://a-cms.slack.com/api/oauth.access?",
            client_id :  "GIVE_IT",
            client_secret: "",
            redirect_uri: "http://GIVE_IT/auth/fromslack2"
        }
    }
}
module.exports = CONFIG;