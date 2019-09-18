
var router = require('express').Router();
var fs = require('fs');
var path = require('path');
const { exec } = require('child_process');

const REFRESH_PUML_LIST_FREQUENCY = 10000;
const KRM_PLATFORM_ROOT = ""
var PUML_FILES = [];

var LAST_REFRESH_TIMESTAMP

/********************* */


/********************* */
/*
- dir : path (from karch_root)
 */
router.get('/browsedir',  (req, res, next) => {
    try {
        shouldRefreshPumls();
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
        shouldRefreshPumls();
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
                    console.log("already exists and uptodate");
                    should_generate = false;
                }
            } catch (e) {
                // continue
                console.log("no existing file, generate it");
            }
        } else {
            console.log("Forced refresh");
        }
        if ( !should_generate ) {
            res.type("image/svg+xml");
            res.sendFile( img_final_name, { root:  global.svgRoot } );
            return;
        } else {
            try {
                res.type("image/svg+xml");

                // FYI, context of execution is root path of script.
                // jar library is weird... it removes -ofile  extension with svg ==> adding ".bla" to keep intact target filename
                exec(' java -jar plant/plantuml.jar -tsvg  -ofile "' + path.join(global.svgRoot, img_final_name.replace(/\.svg$/,".bla")) + '"  "' + full_file_path+'"', (err, stdout, stderr) => {
                    if (err) {
                        res.status(500)
                        res.json({code:"PUML_ERROR", msg:"Generation failed",detail: err.message}); 
                        return;
                    }
                    res.sendFile(img_final_name, { root:  global.svgRoot});
                }); 
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
        shouldRefreshPumls();
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
        use_regex = new RegExp(in_pattern.replace(/\*/g,".*"),"ig");
    }

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
    //console.log("Nb puml in platform/ : " + results.length);
    return results;
}


function shouldRefreshPumls(){
    if ( (Date.now()- LAST_REFRESH_TIMESTAMP) > REFRESH_PUML_LIST_FREQUENCY ) {
        refreshPumlFiles();
    }
}
function refreshPumlFiles (){
    PUML_FILES = readPumlFiles( KRM_PLATFORM_ROOT );
    console.log("Loading PUMLS: " + PUML_FILES.length);
    //setTimeout(refreshPumlFiles, REFRESH_PUML_LIST_FREQUENCY);
    LAST_REFRESH_TIMESTAMP = Date.now(); 
}

//==========================
// Init
//==========================
refreshPumlFiles();

module.exports = router;
