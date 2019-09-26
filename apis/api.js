
var router = require('express').Router();
var fs = require('fs');
var path = require('path');
const { exec } = require('child_process');

const REFRESH_PUML_LIST_FREQUENCY = 60000;
const KRM_PLATFORM_ROOT = "platform"
var PUML_FILES = [];

var LAST_REFRESH_TIMESTAMP

// Due to VM limitation, limit to 2 parallel JAVA generation
var JAVA_QUEUE = [];
var JAVA_COUNTER = 0;
var JAVA_PLANT_INPROGRESS_COUNT = 0;
const JAVA_MAX_PARALLEL = 2;
const JAVA_MAX_QUEUE = 3;
/********************* */


/********************* */
/*
- dir : path (from karch_root)
 */
router.get('/browsedir',  (req, res, next) => {
    try {
        //shouldRefreshPumls();
        var listfiles  = readdir(req.query.dir);
        res.json(listfiles);
    
    } catch (e) {
        res.status(500)
        res.json({code:"SERVER_ERROR", msg: e.msg }); 
    }
});

/********************* */
/*
- file : filename 
- dir : path from karch_root
- force (o) : if present, force  regeneration of SVG
 */
router.get('/getsvgfromfile',  (req, res, next) => {
    try {
        // check if previously generated image exists.
        // if yes, check timestamp vs plantuml source, to see if update required.
        //shouldRefreshPumls();
        var img_basename = req.query.file.replace(/\.\w+$/,""); // remove extension
        var img_final_name = getHashForDir(req.query.dir) + "_" + img_basename + ".svg";

        var full_file_path = path.join(global.repoRoot,  req.query.dir,  req.query.file);
        // get puml file if exists
        try {
            var puml_file_stats = fs.statSync(full_file_path );
        } catch (e) {
            res.status(404)
            res.json({code:"NOT_FOUND", msg:"file not found"}); 
            return;
        } 
        // only launch puml-> svg generation if file is old.
        var should_generate = true;
        if (!req.query.force ){
            try {
                var svg_file_stats = fs.statSync(  path.join( global.svgRoot, img_final_name ) );
                if (svg_file_stats.mtime > puml_file_stats.mtime) {
                    //console.log("already exists and uptodate");
                    should_generate = false;
                }
            } catch (e) {
                // continue
                //console.log("no existing file, generate it");
            }
        } else {
            //console.log("Forced refresh");
        }
        if ( !should_generate ) {
            res.type("image/svg+xml");
            res.sendFile( img_final_name, { root:  global.svgRoot } );
            return;
        } else {
            try {
                res.type("image/svg+xml");
                if ( JAVA_PLANT_INPROGRESS_COUNT >= JAVA_MAX_PARALLEL )   {
                    JAVA_COUNTER ++;
                    if (JAVA_QUEUE.length < JAVA_MAX_QUEUE) {
                        console.log("(" +JAVA_COUNTER+")"+ "Queuing element " +  JAVA_QUEUE.length);
                        // Queue request.
                        JAVA_QUEUE.push({
                            id : JAVA_COUNTER, 
                            res : res,
                            final_name : img_final_name,
                            file_path : full_file_path
                        });
                    } else {
                        console.log("(" +JAVA_COUNTER+")"+ "Too many in QUEUE " + JAVA_QUEUE.length);
                        res.status(503)
                        res.json({code:"SERVER_BUSY", msg:"Please retry later",detail: "Server Busy, hit Refresh in a few"}); 
        
                    }
                    return;    
                }

                javaJarPuml( res, full_file_path,img_final_name , JAVA_COUNTER);

                /*
                // FYI, context of execution is root path of script.
                // jar library is weird... it removes -ofile  extension with svg ==> adding ".bla" to keep intact target filename
                exec(' java -jar plant/plantuml.jar -tsvg  -ofile "' + path.join(global.svgRoot, img_final_name.replace(/\.svg$/,".bla")) + '"  "' + full_file_path+'"', (err, stdout, stderr) => {
                    if (err) {
                        res.status(500)
                        res.json({code:"PUML_ERROR", msg:"Generation failed",detail: err.message}); 
                        return;
                    }
                    res.sendFile(img_final_name, { root:  global.svgRoot});
                }); */
            } catch (e) {
                res.status(500)
                res.json({code:"PUML_ERROR", msg:"Generation failed"}); 
                return;
            }
        }
    } catch (e) {
        res.status(500)
        res.json({code:"SERVER_ERROR", msg: e.msg }); 
    }        
});

function javaJarPuml (res, full_file_path, img_final_name , id ) {
    JAVA_PLANT_INPROGRESS_COUNT ++;
    // FYI, context of execution is root path of script.
    // jar library is weird... it removes -ofile  extension with svg ==> adding ".bla" to keep intact target filename
    exec(' java -jar plant/plantuml.jar -tsvg  -ofile "' + path.join(global.svgRoot, img_final_name.replace(/\.svg$/,".bla")) + '"  "' + full_file_path+'"', (err, stdout, stderr) => {
        JAVA_PLANT_INPROGRESS_COUNT --;
        console.log("(" +id+")"+ "Render Ended " +  JAVA_QUEUE.length);
        //console.log("java jar Ended "  + id);
        if (err) {
            res.status(500)
            res.json({code:"PUML_ERROR", msg:"Generation failed",detail: err.message}); 
            dequeueJavaJar();
            return;
        }
        res.sendFile(img_final_name, { root:  global.svgRoot});
        dequeueJavaJar();
    }); 
}
function dequeueJavaJar(){
    if (JAVA_QUEUE.length) {
        //console.log("Dequeuing element " + JAVA_COUNTER);
        let queued_elem = JAVA_QUEUE[0];
        JAVA_QUEUE.splice(0,1);
        console.log("(" +queued_elem.id+")"+ "Dequeuing element " +  JAVA_QUEUE.length);
        javaJarPuml( queued_elem.res, queued_elem.file_path, queued_elem.final_name, queued_elem.id);
    }
}
/********************* */
/*
- dir : path from karch_root
- file : filename 
*/
router.get('/getmdfile',  (req, res, next) => {
    var full_file_path = path.join(global.repoRoot,  req.query.dir,  req.query.file);
    // get puml file if exists
    try {
       fs.statSync(full_file_path );
    } catch (e) {
        res.status(404)
        res.json({code:"NOT_FOUND", msg:"file not found"}); 
        return;
    } 
    res.type("text/plain");
    res.sendFile(full_file_path);
});


/********************* */
/*  Search a PUML file from API reference
- adapter : adapter 
- verb  :  get/post/delete/... 
- ref : apiCode / eventCode
 */
/* replaced with searchfile
router.get('/searchapi',  (req, res, next) => {
    try {
        shouldRefreshPumls();
        var filepattern = [ req.query.adapter.toLowerCase(), "api", req.query.verb.toLowerCase(), req.query.ref.toLowerCase() ].join("_");
        var matches = searchFilePattern(filepattern)  // Browse through PUML_FILES
        // Group results by Folder ? 
        res.json({
            count : matches.length,
            results : matches
        });
    } catch (e) {
        res.status(500)
        res.json({code:"SERVER_ERROR", msg: e.msg }); 
    }
});
*/

/********************* */
/*  Search a PUML file from filename reference
- filename : xxx     
 */
router.get('/searchfile',  (req, res, next) => {
    try{
        //shouldRefreshPumls();
        var filepattern = req.query.filename.toLowerCase();
        var matches = searchFilePattern(filepattern)  // Browse through PUML_FILES
        // Group results by Folder ? 
        res.json({
            count : matches.length,
            results : matches
        });
    } catch (e) {
        res.status(500)
        res.json({code:"SERVER_ERROR", msg: e.msg }); 
    }
});

/********************* */
/*  Search a PUML file from reference of MQ message
- adapter : adapter 
- ref : eventCode
 */
router.get('/searchmq',  (req, res, next) => {
    try{
        var filepattern = [ req.query.adapter.toLowerCase(), "mq", req.query.ref.toLowerCase() ].join("_");
        var matches = searchFilePattern(filepattern)  // Browse through PUML_FILES
        // Group results by Folder ? 
        res.json({
            count : matches.length,
            results : matches
        });
    } catch (e) {
        res.status(500)
        res.json({code:"SERVER_ERROR", msg: e.msg }); 
    }    
});


/** ******************************************** */
/** ******************************************** */
//          UTILITIES
/** ******************************************** */
/** ******************************************** */
function searchFilePattern(in_pattern){
    var matches = [];
    var use_regex = false;
    // Check for wildcard "*", and use regex is found.
    if (in_pattern.indexOf("*") >= 0 ) {
        console.log("Wildcarded search");
        use_regex = new RegExp(in_pattern.replace(/\*/g,".*"),"i");
    }
    var b = PUML_FILES.filter(f => { if (f.filename.match(/kts_cm/)) return true;})
    b.filter( f => { 
        var a =  use_regex.test(f.filename)
        return a;
    });
    if (use_regex) {
        // Browse through PUML_FILES
        PUML_FILES.forEach( file => {
            if (use_regex.test(file.filename)) {
                matches.push(file);
            }
        });
    } else {
        // Browse through PUML_FILES
        PUML_FILES.forEach( file => {
            if (file.filename.toLowerCase().indexOf(in_pattern) >= 0 ) {
                matches.push(file);
            }
        });
    }
    return matches;
}

function getHashForDir(in_dir) {
    var hash = 0, i, chr;
    if (in_dir.length === 0) return hash;
    for (i = 0; i < in_dir.length; i++) {
      chr   = in_dir.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
};
  


/* Browse a DIRECTORY , non recursively, splitting dirs and files*/
function readdir (dir) {
    var direlems={
        dirs : [],
        files : []
    };
    working_dir = path.join(global.repoRoot, dir?dir:"./");
    var list = fs.readdirSync(working_dir);
    list.forEach(function(file) {
        var fullpath = file;
        if (dir) {
            fullpath = dir + '/' + fullpath;
        } 
        var stat = fs.statSync(path.join(global.repoRoot, fullpath));
        if (stat && stat.isDirectory()) { 
            // Count elem in dir
            var subcount = fs.readdirSync( path.join(global.repoRoot, fullpath)).length;

            direlems.dirs.push({dirname : file, subcount : subcount, path : fullpath});
        } else {
            //its a file
            direlems.files.push({
                filename : file, 
                type : getFileType(file),
                path : dir, 
                ref  : [dir,file].join("/")
            });
        }
    });
    return direlems;
}

function getFileType(in_filename){
    let extension = in_filename.split(".").slice(-1)[0].toLowerCase();
    switch (extension) {
        case "plantuml":
        case "puml":
            return "puml";
            break;
        case "md" : 
            return "md";
            break;
        default : "other";
    }
}
/* DEPRECATED
WAS FULLY SYNC, affecting service availability */
function readPumlFiles (in_dir){
    results = [];
    let working_path = global.repoRoot;
    var pumlRE = "^(?!_)(.*).p(lant){0,1}uml$";
    if (! fs.existsSync( path.join(working_path, in_dir) ) ) {
        return false;
    }
    var dir_content = fs.readdirSync( path.join(working_path, in_dir));
    dir_content.forEach(function(elem) {    
        //console.log(elem);
        var stat = fs.statSync( path.join(working_path, in_dir,elem) );
        if (stat && stat.isDirectory()) { 
            results = results.concat( readPumlFiles( path.join(in_dir, elem) ));
        } else {
            if ( getFileType(elem) == "puml" ){
                results.push( {filename : elem, type : "puml", path : in_dir, ref: in_dir+"/"+elem} );
            }
        }
    });
    return results;
}

async function readPumlFilesAsync (in_dir){
    var results = [];
    let working_path = global.repoRoot;
    if (! fs.existsSync( path.join(working_path, in_dir) ) ) {
        return false;
    }
    var dir_content = await new Promise((resolve,reject) => { 
         fs.readdir( path.join(working_path, in_dir), function(err,files){ 
            if (!err) 
                resolve(files); 
            else reject(err);
        });
    });
    for (let i=0; i < dir_content.length; i++) {
        let elem = dir_content[i];
        if (/^\./.test(elem)) continue;
        var stat = fs.statSync( path.join(working_path, in_dir,elem) );
        if (stat && stat.isDirectory()) { 
            let child_results = await readPumlFilesAsync( path.join(in_dir, elem) );
            results = results.concat( child_results );
        } else {
            if ( getFileType(elem) == "puml" ){
                results.push( {filename : elem, type : "puml", path : in_dir, ref: in_dir+"/"+elem} );
            }
        }
    }
    return results;
}



function shouldRefreshPumls(){
    if ( (Date.now()- LAST_REFRESH_TIMESTAMP) > REFRESH_PUML_LIST_FREQUENCY ) {
        refreshPumlFiles();
    }
}
async function refreshPumlFiles (){
    let start_time =  Date.now() ;
    console.log("Start Refreshing PUML list" );
    var TMP_PUML_FILES = await readPumlFilesAsync( "" );
    let duration = Date.now() - start_time;
    console.log("Nb pumls loaded : " + TMP_PUML_FILES.length +", duration=" + duration);
    PUML_FILES = TMP_PUML_FILES;
    setTimeout(refreshPumlFiles, REFRESH_PUML_LIST_FREQUENCY);
}

//==========================
// Init
//==========================
refreshPumlFiles();

module.exports = router;
