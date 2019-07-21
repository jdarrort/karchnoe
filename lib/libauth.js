var CONFIG = require("../config/config");

var crypto = require('crypto'),
    algorithm = 'aes-256-ctr',
    password = 'karchNoe';
const LIBAUTH = {}

LIBAUTH.getAccessToken = function(){
    var expiration = Date.now() + 1000*14400;
    var cipher = crypto.createCipher(algorithm, CONFIG.AT_PWD)
    var crypted = cipher.update('{"expireAt" : '+expiration +' }','utf8','hex')
    crypted += cipher.final('hex');
    return crypted;
}
 
LIBAUTH.checkAccessToken = function(bearer){
    try {
        if (! bearer) return false;
        var decipher = crypto.createDecipher(algorithm, CONFIG.AT_PWD)
        var dec = decipher.update(bearer,'hex','utf8')
        dec += decipher.final('utf8');
        let at = JSON.parse(dec);
        if (at.expireAt > Date.now()){
            return true;
        } else  { console.log("Token expired");} 
    } catch (e) { }
    return false;
}
module.exports = LIBAUTH;
