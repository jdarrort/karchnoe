const CONFIG= {
    PORT : 80,
    AT_PWD : "CHOSE A RANDOM PASSWORD FOR CRYPTING KARCHNOETOKEN",
    AUTH : {
        DISABLE : false, // set it to true for no AUTH at all.
        SLACK : {
            path : "https://slack.com/api/oauth.access?",
            client_id :  "GIVE_IT",
            client_secret: "GIVE_IT",
            redirect_uri: "GIVE_IT"
        }
    }
}
module.exports = CONFIG;