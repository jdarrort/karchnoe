/*
ACV - KARCH 

must create a dir named   "karch_repo" at the root of program.



*/
const express = require('express')
const path = require('path');
var app = express();



var port ;
process.argv.forEach( (arg, i) => {let v = arg.match(/^--port=(.*)/); if (v) {port = v[1];}});
const C_SERVER_PORT = process.env["KARCH_PORT"] || port || 80 ;
const C_KARCH_REPO = "karch_repo" ; 

global.appRoot = path.resolve(__dirname);
global.repoRoot = path.join(path.resolve(__dirname), C_KARCH_REPO);

app.disable('x-powered-by');
// serve static content.
app.use("/",  express.static( "static" ) );
// serve APIs
app.use( "/api", require("./apis/api"));    

// Start server
app.listen(C_SERVER_PORT, function () {
    console.log(' KARCH  listening on port ' + C_SERVER_PORT)
})
