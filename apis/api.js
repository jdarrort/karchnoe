
var router = require('express').Router();
var fs = require('fs');
var path = require('path');
const { exec } = require('child_process');
const lineReader = require('line-reader');

const REFRESH_PUML_LIST_FREQUENCY = 10000;
const KRM_PLATFORM_ROOT = "platform"
var KMR_ADAPTORS= {};
var PUML_FILES = [];

var LAST_REFRESH_TIMESTAMP

/********************* */
router.get('/loadPUMLs',  (req, res, next) => {
    loadPlatformPumls();
    res.json(PUML_FILES);
    
});

/********************* */
router.get('/browsedir',  (req, res, next) => {
    shouldRefreshPumls();
    var listfiles  = readdir(req.param("dir"));
    res.json(listfiles);
});

/********************* */
/*
- file : filename 
- dir : path from karch_root
- force (o) : force  regeneration of SVG
 */
router.get('/getsvgfromfile',  (req, res, next) => {
    // check if previously generated image exists.
    // if yes, check timestamp vs plantuml source, to see if update required.
    shouldRefreshPumls();
    let imgname =req.param("file").replace(/\.[^/.]+$/, ".svg");

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
    try {
        var svg_target_path = path.join(global.appRoot, "svgs", imgname );
        var svg_file_stats = fs.statSync( svg_target_path );
        if (svg_file_stats.mtime > puml_file_stats.mtime) {
            console.log("already exists and uptodate");
            should_generate = false;
        }
    } catch (e) {
        // continue
        console.log("no existing file, generate it");
    }
    if ( should_generate || req.query["force"]) {
        try {
            // We have an issue when puml explicit a filename : @startuml myOwnFile.puml
            let startRE=/^\s*@startuml\s+(\S+)/
            var shouldRenameFile=false;
            lineReader.eachLine( full_file_path , function(line) {
                if (startRE.test(line)) {
                    shouldRenameFile = line.match(startRE)[1];
                    shouldRenameFile = shouldRenameFile.replace(/\"/g, "");
                    if ( ! (/\.puml$/).test(shouldRefreshPumls) ) {
                        shouldRenameFile += ".puml"
                    }
                    return false; // stop reading
                }
            });
            res.type("image/svg+xml");

            // FYI, context of execution is root path of script.
            
            exec(' java -jar plant/plantuml.jar -tsvg -o '+path.join(global.appRoot, "svgs")+' "' + full_file_path+'"', (err, stdout, stderr) => {
                if (err) {
                    res.status(500)
                    res.json({code:"PUML_ERROR", msg:"Generation failed",detail: err.message}); 
                    return;
                }
                let imgname =req.param("file").replace(/\.[^/.]+$/, ".svg")
                if (shouldRenameFile !==false) {
                    console.log("Rename file todo");
                    try {
                        fs.renameSync("./svgs/"+shouldRenameFile.replace(/\.[^/.]+$/, ".svg") , "./svgs/"+imgname);
                    } catch (e){
                        res.status(500)
                        res.json({code:"PUML_ERROR", msg:"@startuml <Filename> issue",detail: "Please add '.puml' at the end of your startuml statement"}); 
                        return;
                    }
                }
                // Create sym dir in /svgs/folder
                // move produced file to that folder.
                // fs.mkdirSync(  , {recursive:true}, 0o666)
                // fs.rename( , )

                res.sendFile(imgname, { root: "./svgs" });
            }); 
        } catch (e) {
            res.status(500)
            res.json({code:"PUML_ERROR", msg:"Generation failed"}); 
            return;
        }

    } else {
        res.sendFile(imgname, { root: "./svgs" });
    }
});

/********************* */
/*
- file : filename 
- dir : path from karch_root
 */
router.get('/getmdfile',  (req, res, next) => {
    var full_file_path = path.join(global.repoRoot,  req.query.dir,  req.query.file);
    // get puml file if exists
    try {
        var puml_file_stats = fs.statSync(full_file_path );
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
router.get('/searchapiold',  (req, res, next) => {

    // Get Target Adapter
    var target_adapter = KMR_ADAPTORS[req.query.adapter.toLowerCase()];
    if ( ! target_adapter ){
        res.status(404)
        res.json( {code:"NOT_FOUND", msg:"Adaptor not found " + req.query.adapter } ); 
        return;
    }
    var search_path, dir_content, filepattern,file_pattern_re;
    var matchs = [];
    search_path = path.join(target_adapter.path, target_adapter.name + "_APIs");
    if (! fs.existsSync( path.join(global.repoRoot,search_path) ) ) {
        search_path = path.join(target_adapter.path, target_adapter.name + "_apis");
        if (! fs.existsSync( path.join(global.repoRoot,search_path) ) ) {
            res.status(404)
            res.json({code:"NOT_FOUND", msg:"Adaptor API path not found (" + search_path +")"}); 
            return;
        }
    }
    try {
        fs.statSync( path.join(global.repoRoot,search_path) );
    } catch (e){
        res.status(404)
        res.json({code:"NOT_FOUND", msg:"Adaptor API path not found (" + search_path +")"}); 
        return;
    }
    //  ==> "kxx_API_GET_myApiRe_"
    filepattern = [ target_adapter.name, "API", req.query.verb, req.query.ref ].join("_") + "_";

    file_pattern_re = new RegExp("^" + filepattern, "i" ); // case insensitive
    dir_content = readdir(search_path);
    dir_content.files.forEach ( f => {
        if (f.filename.match(file_pattern_re)){
            // Found a matching file !
            matchs.push(f);
        }
    });
    res.json({
        count : matchs.length,
        results : matchs
    });
});



/********************* */
/*  Search a PUML file from API reference
- adapter : adapter 
- verb  :  get/post/delete/... 
- ref : apiCode / eventCode
 */
router.get('/searchapi',  (req, res, next) => {
    shouldRefreshPumls();
    var filepattern = [ req.query.adapter.toLowerCase(), "api", req.query.verb.toLowerCase(), req.query.ref.toLowerCase() ].join("_");
    var matches = searchFilePattern(filepattern)  // Browse through PUML_FILES
    // Group results by Folder ? 
    res.json({
        count : matches.length,
        results : matches
    });
});


/********************* */
/*  Search a PUML file from filename reference
- filename : xxx     
 */
router.get('/searchfile',  (req, res, next) => {
    shouldRefreshPumls();
    var filepattern = req.query.filename.toLowerCase();
    var matches = searchFilePattern(filepattern)  // Browse through PUML_FILES
    // Group results by Folder ? 
    res.json({
        count : matches.length,
        results : matches
    });
});

/********************* */
/*  Search a PUML file from reference of MQ message
- adapter : adapter 
- ref : eventCode
 */
router.get('/searchmq',  (req, res, next) => {
    var filepattern = [ req.query.adapter.toLowerCase(), "mq", req.query.ref.toLowerCase() ].join("_");
    var matches = searchFilePattern(filepattern)  // Browse through PUML_FILES
    // Group results by Folder ? 
    res.json({
        count : matches.length,
        results : matches
    });
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
/*
function buildAdaptorList(){
    var adapt_dir_RE = /plt-[0-9]{3}[_|-](.*)$/
    // build adapter List, stored in global Var.
    console.log("Refreshing adaptorList");
    var adapt_root_dir = path.join(global.repoRoot, KRM_PLATFORM_ROOT );
    var list = fs.readdirSync(adapt_root_dir);
    var matchs;
    KMR_ADAPTORS = {};
    list.forEach( (file)  => {
        var stat = fs.statSync( path.join(adapt_root_dir, file) );
        if ( stat && stat.isDirectory() ) { 
            matchs = file.match(adapt_dir_RE);
            if (matchs) {
                KMR_ADAPTORS[ matchs[1].toLowerCase() ] = {
                    name : matchs[1].toLowerCase(),
                    path : path.join(KRM_PLATFORM_ROOT ,file)
                };
            }
        }
    });
    setTimeout(buildAdaptorList, 60000);
}
// Load Adaptor list
buildAdaptorList();
*/
function shouldRefreshPumls(){
    if ( (Date.now()- LAST_REFRESH_TIMESTAMP) > REFRESH_PUML_LIST_FREQUENCY ) {
        refreshPumlFiles();
    }
}



/* Browse a DIRECTORY , non recursively, splitting dirs and files*/
var readdir = function(dir) {
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
            direlems.files.push({filename : file, type : path.extname(file).substr(1), path : dir, ref: [dir,file].join("/")});
        }
    });
    return direlems;
}

var readPumlFiles = function(in_dir){
    results = [];
    let working_path = global.repoRoot;
    var pumlRE = "^(?!_)(.*).puml$";
    if (! fs.existsSync( path.join(working_path, in_dir) ) ) {
        return false;
    }
    var dir_content = fs.readdirSync( path.join(working_path, in_dir));
    dir_content.forEach(function(elem) {    
        var stat = fs.statSync( path.join(working_path, in_dir,elem) );
        if (stat && stat.isDirectory()) { 
            results = results.concat( readPumlFiles( path.join(in_dir, elem) ));
        } else {
            //it is a file, chck if  (not_)*.puml
            if (elem.match(pumlRE)){
                results.push( {filename : elem, type : "puml", path : in_dir, ref: in_dir+"/"+elem} );
            }
        }
    });
    //console.log("Nb puml in platform/ : " + results.length);
    return results;
}

var refreshPumlFiles = function(){
    PUML_FILES = readPumlFiles( KRM_PLATFORM_ROOT );
    console.log("Loading PUMLS: " + PUML_FILES.length);
    //setTimeout(refreshPumlFiles, REFRESH_PUML_LIST_FREQUENCY);
    LAST_REFRESH_TIMESTAMP = Date.now(); 
}

// Init
refreshPumlFiles();

module.exports = router;
