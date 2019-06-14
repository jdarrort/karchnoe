/*
ACV - KARCH 
*/
const express = require('express')
const path = require('path');
var app = express();
const C_SERVER_PORT = 80

global.appRoot = path.resolve(__dirname);

app.disable('x-powered-by');
// serve static content.
app.use("/",  express.static( "static" ) );
// serve APIs
app.use( "/api", require("./apis/api"));    

// Start server
app.listen(C_SERVER_PORT, function () {
    console.log(' KARCH  listening on port ' + C_SERVER_PORT)
})
