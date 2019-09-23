/* ********************
ACV - KARCH 
must create a dir named   "karch_repo" at the root of program.
******************** */
const express = require('express')
const path = require('path');
var app = express();
const LIBAUTH = require("./lib/libauth");
const CONFIG = require("./config/config");

var port ;
process.argv.forEach( (arg, i) => {let v = arg.match(/^--port=(.*)/); if (v) {port = v[1];}});
const C_SERVER_PORT = process.env["KARCH_PORT"] || port ||  CONFIG.HTTP_PORT || 80 ;
const C_KARCH_REPO = "karch_repo" ; 

global.appRoot = path.resolve(__dirname);
global.repoRoot = path.join(path.resolve(__dirname), C_KARCH_REPO);
global.svgRoot = path.join(path.resolve(__dirname), "svgs");

app.disable('x-powered-by');
// serve static content.
app.use("/",  express.static( "static" ) );

// Enrich res with specific methods
app.use(function (error, req, res, next) {
    res.status(500)
    res.json( { code : "SERVER_ERROR", msg: error.msg } ); 
});

// serve APIs
app.use( "/auth", require("./apis/auth"));    
app.use( "/api", LIBAUTH.authorize, require("./apis/api") );


if (CONFIG.HTTPS) {
    console.log("Starting HTTPS");
    const fs = require("fs");
    const https = require("https");
    var credentials = {
        key  : fs.readFileSync(CONFIG.HTTPS.private_key),
        ca   : fs.readFileSync(CONFIG.HTTPS.ca),
        cert : fs.readFileSync(CONFIG.HTTPS.cert)
    };
    console.log("prepared credentials");
    const httpsServer = https.createServer(credentials, app).listen(443);
    var http = require('http');
    http.createServer(function (req, res) {
        res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
        res.end();
    }).listen(C_SERVER_PORT);
} else {
    // Start server
    console.log("Starting HTTPS");
    app.listen(C_SERVER_PORT, function () {
        console.log( 'KARCH  listening on port ' + C_SERVER_PORT )
    });

}
